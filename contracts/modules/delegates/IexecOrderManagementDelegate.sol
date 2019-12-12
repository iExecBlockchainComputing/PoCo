pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/IexecOrderManagement.sol";


contract IexecOrderManagementDelegate is IexecOrderManagement, DelegateBase
{
	using IexecODBLibOrders_v4 for bytes32;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.AppOrder;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.DatasetOrder;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.WorkerpoolOrder;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.RequestOrder;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.AppOrderOperation;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.DatasetOrderOperation;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.WorkerpoolOrderOperation;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.RequestOrderOperation;

	/***************************************************************************
	 *                         order management tools                          *
	 ***************************************************************************/
	function manageAppOrder(IexecODBLibOrders_v4.AppOrderOperation memory _apporderoperation)
	public
	{
		address owner = App(_apporderoperation.order.app).owner();
		require(owner == msg.sender || owner == _apporderoperation.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR).recover(_apporderoperation.sign));

		bytes32 apporderHash = _apporderoperation.order.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		if (_apporderoperation.operation == IexecODBLibOrders_v4.OrderOperationEnum.SIGN)
		{
			m_presigned[apporderHash] = owner;
			emit SignedAppOrder(apporderHash);
		}
		else if (_apporderoperation.operation == IexecODBLibOrders_v4.OrderOperationEnum.CLOSE)
		{
			m_consumed[apporderHash] = _apporderoperation.order.volume;
			emit ClosedAppOrder(apporderHash);
		}
	}

	function manageDatasetOrder(IexecODBLibOrders_v4.DatasetOrderOperation memory _datasetorderoperation)
	public
	{
		address owner = Dataset(_datasetorderoperation.order.dataset).owner();
		require(owner == msg.sender || owner == _datasetorderoperation.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR).recover(_datasetorderoperation.sign));

		bytes32 datasetorderHash = _datasetorderoperation.order.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		if (_datasetorderoperation.operation == IexecODBLibOrders_v4.OrderOperationEnum.SIGN)
		{
			m_presigned[datasetorderHash] = owner;
			emit SignedDatasetOrder(datasetorderHash);
		}
		else if (_datasetorderoperation.operation == IexecODBLibOrders_v4.OrderOperationEnum.CLOSE)
		{
			m_consumed[datasetorderHash] = _datasetorderoperation.order.volume;
			emit ClosedDatasetOrder(datasetorderHash);
		}
	}

	function manageWorkerpoolOrder(IexecODBLibOrders_v4.WorkerpoolOrderOperation memory _workerpoolorderoperation)
	public
	{
		address owner = Workerpool(_workerpoolorderoperation.order.workerpool).owner();
		require(owner == msg.sender || owner == _workerpoolorderoperation.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR).recover(_workerpoolorderoperation.sign));

		bytes32 workerpoolorderHash = _workerpoolorderoperation.order.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		if (_workerpoolorderoperation.operation == IexecODBLibOrders_v4.OrderOperationEnum.SIGN)
		{
			m_presigned[workerpoolorderHash] = owner;
			emit SignedWorkerpoolOrder(workerpoolorderHash);
		}
		else if (_workerpoolorderoperation.operation == IexecODBLibOrders_v4.OrderOperationEnum.CLOSE)
		{
			m_consumed[workerpoolorderHash] = _workerpoolorderoperation.order.volume;
			emit ClosedWorkerpoolOrder(workerpoolorderHash);
		}
	}

	function manageRequestOrder(IexecODBLibOrders_v4.RequestOrderOperation memory _requestorderoperation)
	public
	{
		address owner = _requestorderoperation.order.requester;
		require(owner == msg.sender || owner == _requestorderoperation.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR).recover(_requestorderoperation.sign));

		bytes32 requestorderHash = _requestorderoperation.order.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		if (_requestorderoperation.operation == IexecODBLibOrders_v4.OrderOperationEnum.SIGN)
		{
			m_presigned[requestorderHash] = owner;
			emit SignedRequestOrder(requestorderHash);
		}
		else if (_requestorderoperation.operation == IexecODBLibOrders_v4.OrderOperationEnum.CLOSE)
		{
			m_consumed[requestorderHash] = _requestorderoperation.order.volume;
			emit ClosedRequestOrder(requestorderHash);
		}
	}
}
