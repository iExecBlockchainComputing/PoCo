// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC5313} from "@openzeppelin/contracts-v5/interfaces/IERC5313.sol";
import {Math} from "@openzeppelin/contracts-v5/utils/math/Math.sol";

import {IexecLibCore_v5} from "../../libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";
import {IWorkerpool} from "../../registries/workerpools/IWorkerpool.v8.sol";
import {DelegateBase} from "../DelegateBase.v8.sol";
import {IexecPoco1} from "../interfaces/IexecPoco1.v8.sol";
import {IexecEscrow} from "./IexecEscrow.v8.sol";
import {SignatureVerifier} from "./SignatureVerifier.v8.sol";

//TODO: Remove each asset struct from Matching
struct Matching {
    bytes apporderStruct;
    bytes32 apporderHash;
    address appOwner;
    bytes datasetorderStruct;
    bytes32 datasetorderHash;
    address datasetOwner;
    bytes workerpoolorderStruct;
    bytes32 workerpoolorderHash;
    address workerpoolOwner;
    bytes requestorderStruct;
    bytes32 requestorderHash;
    bool hasDataset;
}

contract IexecPoco1Delegate is IexecPoco1, DelegateBase, IexecEscrow, SignatureVerifier {
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
    // should be external
    function matchOrders(
        IexecLibOrders_v5.AppOrder calldata _apporder,
        IexecLibOrders_v5.DatasetOrder calldata _datasetorder,
        IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder,
        IexecLibOrders_v5.RequestOrder calldata _requestorder
    ) public override returns (bytes32) {
        /**
         * Check orders compatibility
         */

        // computation environment & allowed enough funds
        bytes32 tag = _apporder.tag | _datasetorder.tag | _requestorder.tag;
        require(_requestorder.category == _workerpoolorder.category, "iExecV5-matchOrders-0x00");
        require(_requestorder.category < m_categories.length, "iExecV5-matchOrders-0x01");
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
            _requestorder.workerpool == address(0) || // TODO: Remove this everywhere since already checked right after
                _isAccountAuthorizedByRestriction(
                    _requestorder.workerpool,
                    _workerpoolorder.workerpool
                ),
            "iExecV5-matchOrders-0x12"
        ); // requestorder.workerpool is a restriction
        require(
            _apporder.datasetrestrict == address(0) ||
                _isAccountAuthorizedByRestriction(_apporder.datasetrestrict, _datasetorder.dataset),
            "iExecV5-matchOrders-0x13"
        );
        require(
            _apporder.workerpoolrestrict == address(0) ||
                _isAccountAuthorizedByRestriction(
                    _apporder.workerpoolrestrict,
                    _workerpoolorder.workerpool
                ),
            "iExecV5-matchOrders-0x14"
        );
        require(
            _apporder.requesterrestrict == address(0) ||
                _isAccountAuthorizedByRestriction(
                    _apporder.requesterrestrict,
                    _requestorder.requester
                ),
            "iExecV5-matchOrders-0x15"
        );
        require(
            _datasetorder.apprestrict == address(0) ||
                _isAccountAuthorizedByRestriction(_datasetorder.apprestrict, _apporder.app),
            "iExecV5-matchOrders-0x16"
        );
        require(
            _datasetorder.workerpoolrestrict == address(0) ||
                _isAccountAuthorizedByRestriction(
                    _datasetorder.workerpoolrestrict,
                    _workerpoolorder.workerpool
                ),
            "iExecV5-matchOrders-0x17"
        );
        require(
            _datasetorder.requesterrestrict == address(0) ||
                _isAccountAuthorizedByRestriction(
                    _datasetorder.requesterrestrict,
                    _requestorder.requester
                ),
            "iExecV5-matchOrders-0x18"
        );
        require(
            _workerpoolorder.apprestrict == address(0) ||
                _isAccountAuthorizedByRestriction(_workerpoolorder.apprestrict, _apporder.app),
            "iExecV5-matchOrders-0x19"
        );
        require(
            _workerpoolorder.datasetrestrict == address(0) ||
                _isAccountAuthorizedByRestriction(
                    _workerpoolorder.datasetrestrict,
                    _datasetorder.dataset
                ),
            "iExecV5-matchOrders-0x1a"
        );
        require(
            _workerpoolorder.requesterrestrict == address(0) ||
                _isAccountAuthorizedByRestriction(
                    _workerpoolorder.requesterrestrict,
                    _requestorder.requester
                ),
            "iExecV5-matchOrders-0x1b"
        );

        /**
         * Check orders authenticity
         */
        Matching memory ids;
        ids.hasDataset = _datasetorder.dataset != address(0);

        // app
        ids.apporderHash = _toTypedDataHash(_apporder.hash());
        ids.appOwner = IERC5313(_apporder.app).owner();

        require(m_appregistry.isRegistered(_apporder.app), "iExecV5-matchOrders-0x20");
        require(
            _verifySignatureOrPresignature(ids.appOwner, ids.apporderHash, _apporder.sign),
            "iExecV5-matchOrders-0x21"
        );
        require(_isAuthorized(ids.appOwner), "iExecV5-matchOrders-0x22");

        // dataset
        if (ids.hasDataset) {
            // only check if dataset is enabled
            ids.datasetorderHash = _toTypedDataHash(_datasetorder.hash());
            ids.datasetOwner = IERC5313(_datasetorder.dataset).owner();

            require(
                m_datasetregistry.isRegistered(_datasetorder.dataset),
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
            require(_isAuthorized(ids.datasetOwner), "iExecV5-matchOrders-0x32");
        }

        // workerpool
        ids.workerpoolorderHash = _toTypedDataHash(_workerpoolorder.hash());
        ids.workerpoolOwner = IERC5313(_workerpoolorder.workerpool).owner();

        require(
            m_workerpoolregistry.isRegistered(_workerpoolorder.workerpool),
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
        require(_isAuthorized(ids.workerpoolOwner), "iExecV5-matchOrders-0x42");

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
        require(_isAuthorized(_requestorder.requester), "iExecV5-matchOrders-0x51");

        /**
         * Check availability
         */
        uint256 volume;
        volume = _apporder.volume - m_consumed[ids.apporderHash];
        volume = ids.hasDataset
            ? volume.min(_datasetorder.volume - m_consumed[ids.datasetorderHash])
            : volume;
        volume = volume.min(_workerpoolorder.volume - m_consumed[ids.workerpoolorderHash]);
        volume = volume.min(_requestorder.volume - m_consumed[ids.requestorderHash]);
        require(volume > 0, "iExecV5-matchOrders-0x60");

        /**
         * Record
         */
        bytes32 dealid = keccak256(
            abi.encodePacked(
                ids.requestorderHash, // requestHash
                m_consumed[ids.requestorderHash] // idx of first subtask
            )
        );

        IexecLibCore_v5.Deal storage deal = m_deals[dealid];
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
        deal.botFirst = m_consumed[ids.requestorderHash];
        deal.botSize = volume;
        deal.workerStake =
            (_workerpoolorder.workerpoolprice *
                IWorkerpool(_workerpoolorder.workerpool).m_workerStakeRatioPolicy()) /
            100;
        deal.schedulerRewardRatio = IWorkerpool(_workerpoolorder.workerpool)
            .m_schedulerRewardRatioPolicy();

        /**
         * Update consumed
         */
        m_consumed[ids.apporderHash] = m_consumed[ids.apporderHash] + volume;
        m_consumed[ids.datasetorderHash] =
            m_consumed[ids.datasetorderHash] +
            (ids.hasDataset ? volume : 0);
        m_consumed[ids.workerpoolorderHash] = m_consumed[ids.workerpoolorderHash] + volume;
        m_consumed[ids.requestorderHash] = m_consumed[ids.requestorderHash] + volume;

        /**
         * Lock
         */
        lock(
            deal.requester,
            (deal.app.price + deal.dataset.price + deal.workerpool.price) * volume
        );
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

    // TODO: Remove method and related usages
    function _isAuthorized(address) internal virtual returns (bool) {
        return true;
    }
}
