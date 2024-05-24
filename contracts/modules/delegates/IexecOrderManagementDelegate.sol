// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

pragma solidity ^0.8.0;

import {IERC5313} from "@openzeppelin/contracts-v5/interfaces/IERC5313.sol";
import {SignatureVerifier} from "./SignatureVerifier.v8.sol";
import {DelegateBase} from "../DelegateBase.v8.sol";
import {IexecOrderManagement} from "../interfaces/IexecOrderManagement.v8.sol";
import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";

contract IexecOrderManagementDelegate is IexecOrderManagement, DelegateBase, SignatureVerifier {
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
}
