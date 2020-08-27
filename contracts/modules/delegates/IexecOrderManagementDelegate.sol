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

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./SignatureVerifier.sol";
import "../DelegateBase.sol";
import "../interfaces/IexecOrderManagement.sol";


contract IexecOrderManagementDelegate is IexecOrderManagement, DelegateBase, SignatureVerifier
{
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
	function manageAppOrder(IexecLibOrders_v5.AppOrderOperation memory _apporderoperation)
	public override
	{
		address owner = App(_apporderoperation.order.app).owner();
		require(owner == _msgSender() || _checkSignature(owner, _toEthTypedStruct(_apporderoperation.hash(), EIP712DOMAIN_SEPARATOR), _apporderoperation.sign), 'invalid-sender-or-signature');

		bytes32 apporderHash = keccak256(_toEthTypedStruct(_apporderoperation.order.hash(), EIP712DOMAIN_SEPARATOR));
		if (_apporderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.SIGN)
		{
			m_presigned[apporderHash] = owner;
			emit SignedAppOrder(apporderHash);
		}
		else if (_apporderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.CLOSE)
		{
			m_consumed[apporderHash] = _apporderoperation.order.volume;
			emit ClosedAppOrder(apporderHash);
		}
	}

	function manageDatasetOrder(IexecLibOrders_v5.DatasetOrderOperation memory _datasetorderoperation)
	public override
	{
		address owner = Dataset(_datasetorderoperation.order.dataset).owner();
		require(owner == _msgSender() || _checkSignature(owner, _toEthTypedStruct(_datasetorderoperation.hash(), EIP712DOMAIN_SEPARATOR), _datasetorderoperation.sign), 'invalid-sender-or-signature');

		bytes32 datasetorderHash = keccak256(_toEthTypedStruct(_datasetorderoperation.order.hash(), EIP712DOMAIN_SEPARATOR));
		if (_datasetorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.SIGN)
		{
			m_presigned[datasetorderHash] = owner;
			emit SignedDatasetOrder(datasetorderHash);
		}
		else if (_datasetorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.CLOSE)
		{
			m_consumed[datasetorderHash] = _datasetorderoperation.order.volume;
			emit ClosedDatasetOrder(datasetorderHash);
		}
	}

	function manageWorkerpoolOrder(IexecLibOrders_v5.WorkerpoolOrderOperation memory _workerpoolorderoperation)
	public override
	{
		address owner = Workerpool(_workerpoolorderoperation.order.workerpool).owner();
		require(owner == _msgSender() || _checkSignature(owner, _toEthTypedStruct(_workerpoolorderoperation.hash(), EIP712DOMAIN_SEPARATOR), _workerpoolorderoperation.sign), 'invalid-sender-or-signature');

		bytes32 workerpoolorderHash = keccak256(_toEthTypedStruct(_workerpoolorderoperation.order.hash(), EIP712DOMAIN_SEPARATOR));
		if (_workerpoolorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.SIGN)
		{
			m_presigned[workerpoolorderHash] = owner;
			emit SignedWorkerpoolOrder(workerpoolorderHash);
		}
		else if (_workerpoolorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.CLOSE)
		{
			m_consumed[workerpoolorderHash] = _workerpoolorderoperation.order.volume;
			emit ClosedWorkerpoolOrder(workerpoolorderHash);
		}
	}

	function manageRequestOrder(IexecLibOrders_v5.RequestOrderOperation memory _requestorderoperation)
	public override
	{
		address owner = _requestorderoperation.order.requester;
		require(owner == _msgSender() || _checkSignature(owner, _toEthTypedStruct(_requestorderoperation.hash(), EIP712DOMAIN_SEPARATOR), _requestorderoperation.sign), 'invalid-sender-or-signature');

		bytes32 requestorderHash = keccak256(_toEthTypedStruct(_requestorderoperation.order.hash(), EIP712DOMAIN_SEPARATOR));
		if (_requestorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.SIGN)
		{
			m_presigned[requestorderHash] = owner;
			emit SignedRequestOrder(requestorderHash);
		}
		else if (_requestorderoperation.operation == IexecLibOrders_v5.OrderOperationEnum.CLOSE)
		{
			m_consumed[requestorderHash] = _requestorderoperation.order.volume;
			emit ClosedRequestOrder(requestorderHash);
		}
	}
}
