// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC5313} from "@openzeppelin/contracts/interfaces/IERC5313.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IexecLibCore_v5} from "../libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";
import {IWorkerpool} from "../registries/workerpools/IWorkerpool.v8.sol";
import {FacetBase} from "../abstract/FacetBase.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
import {IexecPoco1} from "../interfaces/IexecPoco1.sol";
import {IexecEscrow} from "./IexecEscrow.v8.sol";
import {IexecPocoCommon} from "./IexecPocoCommon.sol";
import {SignatureVerifier} from "./SignatureVerifier.sol";

struct Matching {
    bytes32 apporderHash;
    address appOwner;
    bytes32 datasetorderHash;
    address datasetOwner;
    bytes32 workerpoolorderHash;
    address workerpoolOwner;
    bytes32 requestorderHash;
    bool hasDataset;
}

contract IexecPoco1Facet is IexecPoco1, FacetBase, IexecEscrow, SignatureVerifier, IexecPocoCommon {
    using Math for uint256;
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

    /***************************************************************************
     *                           ODB order signature                           *
     ***************************************************************************/
    function verifySignature(
        address _identity,
        bytes32 _hash,
        bytes calldata _signature
    ) external view override returns (bool) {
        return _verifySignature(_identity, _hash, _signature);
    }

    function verifyPresignature(
        address _identity,
        bytes32 _hash
    ) external view override returns (bool) {
        return _verifyPresignature(_identity, _hash);
    }

    function verifyPresignatureOrSignature(
        address _identity,
        bytes32 _hash,
        bytes calldata _signature
    ) external view override returns (bool) {
        return _verifySignatureOrPresignature(_identity, _hash, _signature);
    }

    /**
     * @notice Public view function to check if a dataset order is compatible with a deal.
     * This function performs all the necessary checks to verify dataset order compatibility with a deal.
     * Reverts with `IncompatibleDatasetOrder(reason)` if the dataset order is not compatible with the deal, does
     * nothing otherwise.
     *
     * @dev This function is mainly consumed by offchain clients. It should be carefully inspected if
     * used in on-chain code.
     * @dev This function should not be used in `matchOrders` since it does not check the same requirements.
     * @dev The choice of reverting instead of returning true/false is motivated by the Java middleware
     * requirements.
     *
     * @param dealId The deal ID to check against
     * @param datasetOrder The dataset order to verify
     */
    function assertDatasetDealCompatibility(
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        bytes32 dealId
    ) external view override {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        bytes32 datasetOrderHash = _toTypedDataHash(datasetOrder.hash());
        // Check if dataset order is not revoked or fully consumed.
        // Note: This should be the first check because it is the most important
        // and the most likely to occur (users revoking their dataset orders).
        if ($.m_consumed[datasetOrderHash] >= datasetOrder.volume) {
            revert IncompatibleDatasetOrder("Dataset order is revoked or fully consumed");
        }
        // Check dataset order signature (including presign and ERC-1271).
        address datasetOwner = IERC5313(datasetOrder.dataset).owner();
        if (!_verifySignatureOrPresignature(datasetOwner, datasetOrderHash, datasetOrder.sign)) {
            revert IncompatibleDatasetOrder("Invalid dataset order signature");
        }
        // The deal should exist.
        IexecLibCore_v5.Deal storage deal = $.m_deals[dealId];
        if (deal.requester == address(0)) {
            revert IncompatibleDatasetOrder("Deal not found");
        }
        // The deal should not have a dataset.
        if (deal.dataset.pointer != address(0)) {
            revert IncompatibleDatasetOrder("Deal already has a dataset");
        }
        // The deal's app should be allowed by order restriction.
        if (!_isAccountAuthorizedByRestriction(datasetOrder.apprestrict, deal.app.pointer)) {
            revert IncompatibleDatasetOrder("App restriction not satisfied");
        }
        // The deal's workerpool should be allowed by order restriction.
        if (
            !_isAccountAuthorizedByRestriction(
                datasetOrder.workerpoolrestrict,
                deal.workerpool.pointer
            )
        ) {
            revert IncompatibleDatasetOrder("Workerpool restriction not satisfied");
        }
        // The deal's requester should be allowed by order restriction.
        if (!_isAccountAuthorizedByRestriction(datasetOrder.requesterrestrict, deal.requester)) {
            revert IncompatibleDatasetOrder("Requester restriction not satisfied");
        }
        // The deal's tag should include all tag bits of the dataset order.
        // For dataset orders: ignore Scone, Gramine, and TDX framework bits to allow
        // dataset orders from SGX workerpools to be consumed on TDX workerpools and vice versa.
        // Examples after masking:
        // Deal: 0b0101, Dataset: 0b0101 => Masked Dataset: 0b0001 => ok
        // Deal: 0b0101, Dataset: 0b0001 => Masked Dataset: 0b0001 => ok
        // Deal: 0b1001 (TDX), Dataset: 0b0011 (Scone) => Masked Dataset: 0b0001 => ok (cross-framework compatibility)
        bytes32 maskedDatasetTag = datasetOrder.tag &
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF1;
        if ((deal.tag & maskedDatasetTag) != maskedDatasetTag) {
            revert IncompatibleDatasetOrder("Tag compatibility not satisfied");
        }
    }

    /***************************************************************************
     *                           ODB order matching                            *
     ***************************************************************************/
    /**
     * Match orders. The requester gets debited.
     *
     * @notice This function does not use `msg.sender` to determine who pays for the deal.
     * The sponsor is always set to `_requestorder.requester`, regardless of who calls this function.
     * This design allows the function to be safely called via delegatecall from other facets
     * (e.g., IexecEscrowTokenFacet.receiveApproval) without security concerns.
     *
     * @param _apporder The app order.
     * @param _datasetorder The dataset order.
     * @param _workerpoolorder The workerpool order.
     * @param _requestorder The requester order.
     */
    function matchOrders(
        IexecLibOrders_v5.AppOrder calldata _apporder,
        IexecLibOrders_v5.DatasetOrder calldata _datasetorder,
        IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder,
        IexecLibOrders_v5.RequestOrder calldata _requestorder
    ) external override returns (bytes32) {
        return
            _matchOrders(
                _apporder,
                _datasetorder,
                _workerpoolorder,
                _requestorder,
                _requestorder.requester
            );
    }

    // TODO: check if we want to modify sponsor origin to be a variable instead of msg.sender
    /**
     * Sponsor match orders for a requester.
     * Unlike the standard `matchOrders(..)` hook where the requester pays for
     * the deal, this current hook makes it possible for any `msg.sender` to pay for
     * a third party requester.
     *
     * @notice Be aware that anyone seeing a valid request order on the network
     * (via an off-chain public marketplace, via a `sponsorMatchOrders(..)`
     * pending transaction in the mempool or by any other means) might decide
     * to call the standard `matchOrders(..)` hook which will result in the
     * requester being debited instead. Therefore, such a front run would result
     * in a loss of some of the requester funds deposited in the iExec account
     * (a loss value equivalent to the price of the deal).
     *
     * @param _apporder The app order.
     * @param _datasetorder The dataset order.
     * @param _workerpoolorder The workerpool order.
     * @param _requestorder The requester order.
     */
    function sponsorMatchOrders(
        IexecLibOrders_v5.AppOrder calldata _apporder,
        IexecLibOrders_v5.DatasetOrder calldata _datasetorder,
        IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder,
        IexecLibOrders_v5.RequestOrder calldata _requestorder
    ) external override returns (bytes32) {
        address sponsor = msg.sender;
        bytes32 dealId = _matchOrders(
            _apporder,
            _datasetorder,
            _workerpoolorder,
            _requestorder,
            sponsor
        );
        emit DealSponsored(dealId, sponsor);
        return dealId;
    }

    /**
     * Match orders and specify a sponsor in charge of paying for the deal.
     *
     * @param _apporder The app order.
     * @param _datasetorder The dataset order.
     * @param _workerpoolorder The workerpool order.
     * @param _requestorder The requester order.
     * @param _sponsor The sponsor in charge of paying the deal.
     */
    function _matchOrders(
        IexecLibOrders_v5.AppOrder calldata _apporder,
        IexecLibOrders_v5.DatasetOrder calldata _datasetorder,
        IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder,
        IexecLibOrders_v5.RequestOrder calldata _requestorder,
        address _sponsor
    ) private returns (bytes32) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        /**
         * Check orders compatibility
         */

        // computation environment & allowed enough funds
        if (_requestorder.category != _workerpoolorder.category) {
            revert CategoryMismatch(_requestorder.category, _workerpoolorder.category);
        }
        if (_requestorder.category >= $.m_categories.length) {
            revert UnknownCategory(_requestorder.category, $.m_categories.length);
        }
        if (_requestorder.trust > _workerpoolorder.trust) {
            revert TrustMismatch(_requestorder.trust, _workerpoolorder.trust);
        }

        if (_requestorder.appmaxprice < _apporder.appprice) {
            revert AppPriceTooHigh(_apporder.appprice, _requestorder.appmaxprice);
        }
        if (_requestorder.datasetmaxprice < _datasetorder.datasetprice) {
            revert DatasetPriceTooHigh(_datasetorder.datasetprice, _requestorder.datasetmaxprice);
        }
        if (_requestorder.workerpoolmaxprice < _workerpoolorder.workerpoolprice) {
            revert WorkerpoolPriceTooHigh(
                _workerpoolorder.workerpoolprice,
                _requestorder.workerpoolmaxprice
            );
        }
        // The workerpool tag should include all tag bits of dataset, app, and requester orders.
        // For dataset orders: ignore Scone, Gramine, and TDX framework bits to allow
        // dataset orders from SGX workerpools to be consumed on TDX workerpools and vice versa.
        // Bit positions: bit 0 = TEE, bit 1 = Scone, bit 2 = Gramine, bit 3 = TDX
        // Mask: ~(BIT_SCONE | BIT_GRAMINE | BIT_TDX) = ~0xE = 0xFFF...FF1
        bytes32 maskedDatasetTag = _datasetorder.tag &
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF1;
        bytes32 tag = _apporder.tag | maskedDatasetTag | _requestorder.tag;
        if (tag & ~_workerpoolorder.tag != 0x0) {
            revert TagMismatch(tag, _workerpoolorder.tag);
        }
        if ((tag ^ _apporder.tag)[31] & 0x01 != 0x0) {
            revert AppTagMismatch(_requestorder.tag, _apporder.tag);
        }

        // Check matching and restrictions
        if (_requestorder.app != _apporder.app) {
            revert AppMismatch(_requestorder.app, _apporder.app);
        }

        if (_requestorder.dataset != _datasetorder.dataset) {
            revert DatasetMismatch(_requestorder.dataset, _datasetorder.dataset);
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _requestorder.workerpool,
                _workerpoolorder.workerpool
            )
        ) {
            revert WorkerpoolMismatch(_requestorder.workerpool, _workerpoolorder.workerpool);
        } // requestorder.workerpool is a restriction
        if (!_isAccountAuthorizedByRestriction(_apporder.datasetrestrict, _datasetorder.dataset)) {
            revert DatasetRestrictionMismatch(_apporder.datasetrestrict, _datasetorder.dataset);
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _apporder.workerpoolrestrict,
                _workerpoolorder.workerpool
            )
        ) {
            revert WorkerpoolRestrictionMismatch(
                _apporder.workerpoolrestrict,
                _workerpoolorder.workerpool
            );
        }
        if (
            !_isAccountAuthorizedByRestriction(_apporder.requesterrestrict, _requestorder.requester)
        ) {
            revert RequesterRestrictionMismatch(
                _apporder.requesterrestrict,
                _requestorder.requester
            );
        }
        if (!_isAccountAuthorizedByRestriction(_datasetorder.apprestrict, _apporder.app)) {
            revert AppRestrictionMismatch(_datasetorder.apprestrict, _apporder.app);
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _datasetorder.workerpoolrestrict,
                _workerpoolorder.workerpool
            )
        ) {
            revert WorkerpoolRestrictionMismatch(
                _datasetorder.workerpoolrestrict,
                _workerpoolorder.workerpool
            );
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _datasetorder.requesterrestrict,
                _requestorder.requester
            )
        ) {
            revert RequesterRestrictionMismatch(
                _datasetorder.requesterrestrict,
                _requestorder.requester
            );
        }
        if (!_isAccountAuthorizedByRestriction(_workerpoolorder.apprestrict, _apporder.app)) {
            revert AppRestrictionMismatch(_workerpoolorder.apprestrict, _apporder.app);
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _workerpoolorder.datasetrestrict,
                _datasetorder.dataset
            )
        ) {
            revert DatasetRestrictionMismatch(
                _workerpoolorder.datasetrestrict,
                _datasetorder.dataset
            );
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _workerpoolorder.requesterrestrict,
                _requestorder.requester
            )
        ) {
            revert RequesterRestrictionMismatch(
                _workerpoolorder.requesterrestrict,
                _requestorder.requester
            );
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _datasetorder.workerpoolrestrict,
                _workerpoolorder.workerpool
            )
        ) {
            revert WorkerpoolRestrictionMismatch(
                _datasetorder.workerpoolrestrict,
                _workerpoolorder.workerpool
            );
        }

        if (
            !_isAccountAuthorizedByRestriction(
                _datasetorder.requesterrestrict,
                _requestorder.requester
            )
        ) {
            revert RequesterRestrictionMismatch(
                _datasetorder.requesterrestrict,
                _requestorder.requester
            );
        }
        if (!_isAccountAuthorizedByRestriction(_workerpoolorder.apprestrict, _apporder.app)) {
            revert AppRestrictionMismatch(_workerpoolorder.apprestrict, _apporder.app);
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _workerpoolorder.datasetrestrict,
                _datasetorder.dataset
            )
        ) {
            revert DatasetRestrictionMismatch(
                _workerpoolorder.datasetrestrict,
                _datasetorder.dataset
            );
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _workerpoolorder.requesterrestrict,
                _requestorder.requester
            )
        ) {
            revert RequesterRestrictionMismatch(
                _workerpoolorder.requesterrestrict,
                _requestorder.requester
            );
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _workerpoolorder.datasetrestrict,
                _datasetorder.dataset
            )
        ) {
            revert DatasetRestrictionMismatch(
                _workerpoolorder.datasetrestrict,
                _datasetorder.dataset
            );
        }
        if (
            !_isAccountAuthorizedByRestriction(
                _workerpoolorder.requesterrestrict,
                _requestorder.requester
            )
        ) {
            revert RequesterRestrictionMismatch(
                _workerpoolorder.requesterrestrict,
                _requestorder.requester
            );
        }

        /**
         * Check orders authenticity
         */
        //slither-disable-next-line uninitialized-local
        Matching memory ids;
        ids.hasDataset = _datasetorder.dataset != address(0);

        // app
        ids.apporderHash = _toTypedDataHash(_apporder.hash());
        ids.appOwner = IERC5313(_apporder.app).owner();

        if (!$.m_appregistry.isRegistered(_apporder.app)) {
            revert AppNotRegistered(_apporder.app);
        }
        if (!_verifySignatureOrPresignature(ids.appOwner, ids.apporderHash, _apporder.sign)) {
            revert InvalidAppOrderSignature(ids.appOwner, ids.apporderHash);
        }

        // dataset
        if (ids.hasDataset) {
            // only check if dataset is enabled
            ids.datasetorderHash = _toTypedDataHash(_datasetorder.hash());
            ids.datasetOwner = IERC5313(_datasetorder.dataset).owner();

            if (!$.m_datasetregistry.isRegistered(_datasetorder.dataset)) {
                revert DatasetNotRegistered(_datasetorder.dataset);
            }
            if (
                !_verifySignatureOrPresignature(
                    ids.datasetOwner,
                    ids.datasetorderHash,
                    _datasetorder.sign
                )
            ) {
                revert InvalidDatasetOrderSignature(ids.datasetOwner, ids.datasetorderHash);
            }
        }

        // workerpool
        ids.workerpoolorderHash = _toTypedDataHash(_workerpoolorder.hash());
        ids.workerpoolOwner = IERC5313(_workerpoolorder.workerpool).owner();
        if (!$.m_workerpoolregistry.isRegistered(_workerpoolorder.workerpool)) {
            revert WorkerpoolNotRegistered(_workerpoolorder.workerpool);
        }
        if (
            !_verifySignatureOrPresignature(
                ids.workerpoolOwner,
                ids.workerpoolorderHash,
                _workerpoolorder.sign
            )
        ) {
            revert InvalidWorkerpoolOrderSignature(ids.workerpoolOwner, ids.workerpoolorderHash);
        }

        // request
        ids.requestorderHash = _toTypedDataHash(_requestorder.hash());
        if (
            !_verifySignatureOrPresignature(
                _requestorder.requester,
                ids.requestorderHash,
                _requestorder.sign
            )
        ) {
            revert InvalidRequestOrderSignature(_requestorder.requester, ids.requestorderHash);
        }

        /**
         * Check availability
         */
        uint256 volume = _computeDealVolume(
            _apporder.volume,
            ids.apporderHash,
            ids.hasDataset,
            _datasetorder.volume,
            ids.datasetorderHash,
            _workerpoolorder.volume,
            ids.workerpoolorderHash,
            _requestorder.volume,
            ids.requestorderHash
        );
        if (volume == 0) {
            revert OrdersConsumed();
        }

        /**
         * Record
         */
        bytes32 dealid = keccak256(
            abi.encodePacked(
                ids.requestorderHash, // requestHash
                $.m_consumed[ids.requestorderHash] // idx of first subtask
            )
        );

        IexecLibCore_v5.Deal storage deal = $.m_deals[dealid];
        deal.app.pointer = _apporder.app;
        deal.app.owner = ids.appOwner;
        deal.app.price = _apporder.appprice;
        deal.dataset.owner = ids.datasetOwner;
        deal.dataset.pointer = _datasetorder.dataset;
        deal.dataset.price = ids.hasDataset ? _datasetorder.datasetprice : 0;
        deal.workerpool.pointer = _workerpoolorder.workerpool;
        deal.workerpool.owner = ids.workerpoolOwner;
        deal.workerpool.price = _workerpoolorder.workerpoolprice;
        deal.trust = _requestorder.trust.max(1);
        deal.category = _requestorder.category;
        deal.tag = tag;
        deal.requester = _requestorder.requester;
        deal.beneficiary = _requestorder.beneficiary;
        deal.callback = _requestorder.callback;
        deal.params = _requestorder.params;
        deal.startTime = block.timestamp;
        deal.botFirst = $.m_consumed[ids.requestorderHash];
        deal.botSize = volume;
        deal.workerStake =
            (_workerpoolorder.workerpoolprice *
                IWorkerpool(_workerpoolorder.workerpool).m_workerStakeRatioPolicy()) /
            100;
        deal.schedulerRewardRatio = IWorkerpool(_workerpoolorder.workerpool)
            .m_schedulerRewardRatioPolicy();
        deal.sponsor = _sponsor;

        /**
         * Update consumed
         */
        $.m_consumed[ids.apporderHash] = $.m_consumed[ids.apporderHash] + volume;
        $.m_consumed[ids.datasetorderHash] =
            $.m_consumed[ids.datasetorderHash] +
            (ids.hasDataset ? volume : 0);
        $.m_consumed[ids.workerpoolorderHash] = $.m_consumed[ids.workerpoolorderHash] + volume;
        $.m_consumed[ids.requestorderHash] = $.m_consumed[ids.requestorderHash] + volume;

        /**
         * Lock
         */
        lock(_sponsor, (deal.app.price + deal.dataset.price + deal.workerpool.price) * volume);
        //slither-disable-next-line divide-before-multiply
        lock(
            deal.workerpool.owner,
            ((deal.workerpool.price * WORKERPOOL_STAKE_RATIO) / 100) * volume // ORDER IS IMPORTANT HERE!
        );

        /**
         * Advertize deal
         */
        emit SchedulerNotice(deal.workerpool.pointer, dealid);

        /**
         * Advertize consumption
         */
        emit OrdersMatched(
            dealid,
            ids.apporderHash,
            ids.datasetorderHash,
            ids.workerpoolorderHash,
            ids.requestorderHash,
            volume
        );

        return dealid;
    }
}
