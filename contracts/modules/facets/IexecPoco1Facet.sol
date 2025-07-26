// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC5313} from "@openzeppelin/contracts-v5/interfaces/IERC5313.sol";
import {Math} from "@openzeppelin/contracts-v5/utils/math/Math.sol";

import {IexecLibCore_v5} from "../../libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";
import {IWorkerpool} from "../../registries/workerpools/IWorkerpool.v8.sol";
import {FacetBase} from "./FacetBase.v8.sol";
import {IexecPoco1} from "../../interfaces/IexecPoco1.v8.sol";
import {IexecEscrow} from "./IexecEscrow.v8.sol";
import {IexecPocoCommonFacet} from "./IexecPocoCommonFacet.sol";
import {SignatureVerifier} from "./SignatureVerifier.v8.sol";

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

contract IexecPoco1Facet is
    IexecPoco1,
    FacetBase,
    IexecEscrow,
    SignatureVerifier,
    IexecPocoCommonFacet
{
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

    /***************************************************************************
     *                           ODB order matching                            *
     ***************************************************************************/
    /**
     * Match orders. The requester gets debited.
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
        PocoStorage storage $ = getPocoStorage();
        /**
         * Check orders compatibility
         */

        // computation environment & allowed enough funds
        bytes32 tag = _apporder.tag | _datasetorder.tag | _requestorder.tag;
        require(_requestorder.category == _workerpoolorder.category, "iExecV5-matchOrders-0x00");
        require(_requestorder.category < $.m_categories.length, "iExecV5-matchOrders-0x01");
        require(_requestorder.trust <= _workerpoolorder.trust, "iExecV5-matchOrders-0x02");
        require(_requestorder.appmaxprice >= _apporder.appprice, "iExecV5-matchOrders-0x03");
        require(
            _requestorder.datasetmaxprice >= _datasetorder.datasetprice,
            "iExecV5-matchOrders-0x04"
        );
        require(
            _requestorder.workerpoolmaxprice >= _workerpoolorder.workerpoolprice,
            "iExecV5-matchOrders-0x05"
        );
        require(tag & ~_workerpoolorder.tag == 0x0, "iExecV5-matchOrders-0x06");
        require((tag ^ _apporder.tag)[31] & 0x01 == 0x0, "iExecV5-matchOrders-0x07");

        // Check matching and restrictions
        require(_requestorder.app == _apporder.app, "iExecV5-matchOrders-0x10");
        require(_requestorder.dataset == _datasetorder.dataset, "iExecV5-matchOrders-0x11");
        require(
            _isAccountAuthorizedByRestriction(
                _requestorder.workerpool,
                _workerpoolorder.workerpool
            ),
            "iExecV5-matchOrders-0x12"
        ); // requestorder.workerpool is a restriction
        require(
            _isAccountAuthorizedByRestriction(_apporder.datasetrestrict, _datasetorder.dataset),
            "iExecV5-matchOrders-0x13"
        );
        require(
            _isAccountAuthorizedByRestriction(
                _apporder.workerpoolrestrict,
                _workerpoolorder.workerpool
            ),
            "iExecV5-matchOrders-0x14"
        );
        require(
            _isAccountAuthorizedByRestriction(_apporder.requesterrestrict, _requestorder.requester),
            "iExecV5-matchOrders-0x15"
        );
        require(
            _isAccountAuthorizedByRestriction(_datasetorder.apprestrict, _apporder.app),
            "iExecV5-matchOrders-0x16"
        );
        require(
            _isAccountAuthorizedByRestriction(
                _datasetorder.workerpoolrestrict,
                _workerpoolorder.workerpool
            ),
            "iExecV5-matchOrders-0x17"
        );
        require(
            _isAccountAuthorizedByRestriction(
                _datasetorder.requesterrestrict,
                _requestorder.requester
            ),
            "iExecV5-matchOrders-0x18"
        );
        require(
            _isAccountAuthorizedByRestriction(_workerpoolorder.apprestrict, _apporder.app),
            "iExecV5-matchOrders-0x19"
        );
        require(
            _isAccountAuthorizedByRestriction(
                _workerpoolorder.datasetrestrict,
                _datasetorder.dataset
            ),
            "iExecV5-matchOrders-0x1a"
        );
        require(
            _isAccountAuthorizedByRestriction(
                _workerpoolorder.requesterrestrict,
                _requestorder.requester
            ),
            "iExecV5-matchOrders-0x1b"
        );

        /**
         * Check orders authenticity
         */
        //slither-disable-next-line uninitialized-local
        Matching memory ids;
        ids.hasDataset = _datasetorder.dataset != address(0);

        // app
        ids.apporderHash = _toTypedDataHash(_apporder.hash());
        ids.appOwner = IERC5313(_apporder.app).owner();

        require($.m_appregistry.isRegistered(_apporder.app), "iExecV5-matchOrders-0x20");
        require(
            _verifySignatureOrPresignature(ids.appOwner, ids.apporderHash, _apporder.sign),
            "iExecV5-matchOrders-0x21"
        );

        // dataset
        if (ids.hasDataset) {
            // only check if dataset is enabled
            ids.datasetorderHash = _toTypedDataHash(_datasetorder.hash());
            ids.datasetOwner = IERC5313(_datasetorder.dataset).owner();

            require(
                $.m_datasetregistry.isRegistered(_datasetorder.dataset),
                "iExecV5-matchOrders-0x30"
            );
            require(
                _verifySignatureOrPresignature(
                    ids.datasetOwner,
                    ids.datasetorderHash,
                    _datasetorder.sign
                ),
                "iExecV5-matchOrders-0x31"
            );
        }

        // workerpool
        ids.workerpoolorderHash = _toTypedDataHash(_workerpoolorder.hash());
        ids.workerpoolOwner = IERC5313(_workerpoolorder.workerpool).owner();

        require(
            $.m_workerpoolregistry.isRegistered(_workerpoolorder.workerpool),
            "iExecV5-matchOrders-0x40"
        );
        require(
            _verifySignatureOrPresignature(
                ids.workerpoolOwner,
                ids.workerpoolorderHash,
                _workerpoolorder.sign
            ),
            "iExecV5-matchOrders-0x41"
        );

        // request
        ids.requestorderHash = _toTypedDataHash(_requestorder.hash());
        require(
            _verifySignatureOrPresignature(
                _requestorder.requester,
                ids.requestorderHash,
                _requestorder.sign
            ),
            "iExecV5-matchOrders-0x50"
        );

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
        require(volume > 0, "iExecV5-matchOrders-0x60");

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
