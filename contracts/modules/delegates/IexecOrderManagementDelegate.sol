// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC5313} from "@openzeppelin/contracts-v5/interfaces/IERC5313.sol";
import {Math} from "@openzeppelin/contracts-v5/utils/math/Math.sol";
import {SignatureVerifier} from "./SignatureVerifier.v8.sol";
import {DelegateBase} from "../DelegateBase.v8.sol";
import {IexecOrderManagement} from "../interfaces/IexecOrderManagement.v8.sol";
import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";

contract IexecOrderManagementDelegate is IexecOrderManagement, DelegateBase, SignatureVerifier {
    using Math for uint256;
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrderOperation;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrderOperation;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrderOperation;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrderOperation;

    /***************************************************************************
     *                         order management tools                          *
     ***************************************************************************/
    function manageAppOrder(
        IexecLibOrders_v5.AppOrderOperation calldata _apporderoperation
    ) public override {
        address owner = IERC5313(_apporderoperation.order.app).owner();
        require(
            owner == _msgSender() ||
                _verifySignature(
                    owner,
                    _toTypedDataHash(_apporderoperation.hash()),
                    _apporderoperation.sign
                ),
            "invalid-sender-or-signature"
        );

        bytes32 apporderHash = _toTypedDataHash(_apporderoperation.order.hash());
        if (_apporderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.SIGN) {
            m_presigned[apporderHash] = owner;
            emit SignedAppOrder(apporderHash);
        } else if (_apporderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.CLOSE) {
            m_consumed[apporderHash] = _apporderoperation.order.volume;
            emit ClosedAppOrder(apporderHash);
        }
    }

    function manageDatasetOrder(
        IexecLibOrders_v5.DatasetOrderOperation calldata _datasetorderoperation
    ) public override {
        address owner = IERC5313(_datasetorderoperation.order.dataset).owner();
        require(
            owner == _msgSender() ||
                _verifySignature(
                    owner,
                    _toTypedDataHash(_datasetorderoperation.hash()),
                    _datasetorderoperation.sign
                ),
            "invalid-sender-or-signature"
        );

        bytes32 datasetorderHash = _toTypedDataHash(_datasetorderoperation.order.hash());
        if (_datasetorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.SIGN) {
            m_presigned[datasetorderHash] = owner;
            emit SignedDatasetOrder(datasetorderHash);
        } else if (_datasetorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.CLOSE) {
            m_consumed[datasetorderHash] = _datasetorderoperation.order.volume;
            emit ClosedDatasetOrder(datasetorderHash);
        }
    }

    function manageWorkerpoolOrder(
        IexecLibOrders_v5.WorkerpoolOrderOperation calldata _workerpoolorderoperation
    ) public override {
        address owner = IERC5313(_workerpoolorderoperation.order.workerpool).owner();
        require(
            owner == _msgSender() ||
                _verifySignature(
                    owner,
                    _toTypedDataHash(_workerpoolorderoperation.hash()),
                    _workerpoolorderoperation.sign
                ),
            "invalid-sender-or-signature"
        );

        bytes32 workerpoolorderHash = _toTypedDataHash(_workerpoolorderoperation.order.hash());
        if (_workerpoolorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.SIGN) {
            m_presigned[workerpoolorderHash] = owner;
            emit SignedWorkerpoolOrder(workerpoolorderHash);
        } else if (
            _workerpoolorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.CLOSE
        ) {
            m_consumed[workerpoolorderHash] = _workerpoolorderoperation.order.volume;
            emit ClosedWorkerpoolOrder(workerpoolorderHash);
        }
    }

    function manageRequestOrder(
        IexecLibOrders_v5.RequestOrderOperation calldata _requestorderoperation
    ) public override {
        address owner = _requestorderoperation.order.requester;
        require(
            owner == _msgSender() ||
                _verifySignature(
                    owner,
                    _toTypedDataHash(_requestorderoperation.hash()),
                    _requestorderoperation.sign
                ),
            "invalid-sender-or-signature"
        );

        bytes32 requestorderHash = _toTypedDataHash(_requestorderoperation.order.hash());
        if (_requestorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.SIGN) {
            m_presigned[requestorderHash] = owner;
            emit SignedRequestOrder(requestorderHash);
        } else if (_requestorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.CLOSE) {
            m_consumed[requestorderHash] = _requestorderoperation.order.volume;
            emit ClosedRequestOrder(requestorderHash);
        }
    }

    function computeDealVolume(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external view override returns (uint256 volume) {
        return
            _computeVolume(
                appOrder.volume,
                _toTypedDataHash(appOrder.hash()),
                datasetOrder.dataset != address(0),
                datasetOrder.volume,
                _toTypedDataHash(datasetOrder.hash()),
                workerpoolOrder.volume,
                _toTypedDataHash(workerpoolOrder.hash()),
                requestOrder.volume,
                _toTypedDataHash(requestOrder.hash())
            );
    }

    function _computeVolume(
        uint256 apporderVolume,
        bytes32 appOrderTypedDataHash,
        bool hasDataset,
        uint256 datasetorderVolume,
        bytes32 datasetOrderTypedDataHash,
        uint256 workerpoolorderVolume,
        bytes32 workerpoolOrderTypedDataHash,
        uint256 requestorderVolume,
        bytes32 requestOrderTypedDataHash
    ) internal view returns (uint256 volume) {
        volume = apporderVolume - m_consumed[appOrderTypedDataHash];
        volume = hasDataset
            ? volume.min(datasetorderVolume - m_consumed[datasetOrderTypedDataHash])
            : volume;
        volume = volume.min(workerpoolorderVolume - m_consumed[workerpoolOrderTypedDataHash]);
        volume = volume.min(requestorderVolume - m_consumed[requestOrderTypedDataHash]);
    }
}
