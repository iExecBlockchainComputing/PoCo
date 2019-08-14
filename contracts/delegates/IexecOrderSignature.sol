pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";


interface IexecOrderSignature
{
	event ClosedAppOrder       (bytes32 appHash);
	event ClosedDatasetOrder   (bytes32 datasetHash);
	event ClosedWorkerpoolOrder(bytes32 workerpoolHash);
	event ClosedRequestOrder   (bytes32 requestHash);

	function signAppOrder         (IexecODBLibOrders.AppOrder        calldata) external returns (bool);
	function signDatasetOrder     (IexecODBLibOrders.DatasetOrder    calldata) external returns (bool);
	function signWorkerpoolOrder  (IexecODBLibOrders.WorkerpoolOrder calldata) external returns (bool);
	function signRequestOrder     (IexecODBLibOrders.RequestOrder    calldata) external returns (bool);
	function cancelAppOrder       (IexecODBLibOrders.AppOrder        calldata) external returns (bool);
	function cancelDatasetOrder   (IexecODBLibOrders.DatasetOrder    calldata) external returns (bool);
	function cancelWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder calldata) external returns (bool);
	function cancelRequestOrder   (IexecODBLibOrders.RequestOrder    calldata) external returns (bool);
}

contract IexecOrderSignatureDelegate is IexecOrderSignature, DelegateBase
{
	using IexecODBLibOrders for bytes32;
	using IexecODBLibOrders for IexecODBLibOrders.AppOrder;
	using IexecODBLibOrders for IexecODBLibOrders.DatasetOrder;
	using IexecODBLibOrders for IexecODBLibOrders.WorkerpoolOrder;
	using IexecODBLibOrders for IexecODBLibOrders.RequestOrder;

	/***************************************************************************
	 *                            pre-signing tools                            *
	 ***************************************************************************/
	// should be external
	function signAppOrder(IexecODBLibOrders.AppOrder memory _apporder)
	public returns (bool)
	{
		require(msg.sender == App(_apporder.app).owner());
		m_presigned[_apporder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR)] = true;
		return true;
	}

	// should be external
	function signDatasetOrder(IexecODBLibOrders.DatasetOrder memory _datasetorder)
	public returns (bool)
	{
		require(msg.sender == Dataset(_datasetorder.dataset).owner());
		m_presigned[_datasetorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR)] = true;
		return true;
	}

	// should be external
	function signWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder memory _workerpoolorder)
	public returns (bool)
	{
		require(msg.sender == Workerpool(_workerpoolorder.workerpool).owner());
		m_presigned[_workerpoolorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR)] = true;
		return true;
	}

	// should be external
	function signRequestOrder(IexecODBLibOrders.RequestOrder memory _requestorder)
	public returns (bool)
	{
		require(msg.sender == _requestorder.requester);
		m_presigned[_requestorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR)] = true;
		return true;
	}

	/***************************************************************************
	 *                            cancelling tools                             *
	 ***************************************************************************/
	// should be external
	function cancelAppOrder(IexecODBLibOrders.AppOrder memory _apporder)
	public returns (bool)
	{
		bytes32 dapporderHash = _apporder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		require(msg.sender == App(_apporder.app).owner());
		m_consumed[dapporderHash] = _apporder.volume;
		emit ClosedAppOrder(dapporderHash);
		return true;
	}

	// should be external
	function cancelDatasetOrder(IexecODBLibOrders.DatasetOrder memory _datasetorder)
	public returns (bool)
	{
		bytes32 dataorderHash = _datasetorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		require(msg.sender == Dataset(_datasetorder.dataset).owner());
		m_consumed[dataorderHash] = _datasetorder.volume;
		emit ClosedDatasetOrder(dataorderHash);
		return true;
	}

	// should be external
	function cancelWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder memory _workerpoolorder)
	public returns (bool)
	{
		bytes32 poolorderHash = _workerpoolorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		require(msg.sender == Workerpool(_workerpoolorder.workerpool).owner());
		m_consumed[poolorderHash] = _workerpoolorder.volume;
		emit ClosedWorkerpoolOrder(poolorderHash);
		return true;
	}

	// should be external
	function cancelRequestOrder(IexecODBLibOrders.RequestOrder memory _requestorder)
	public returns (bool)
	{
		bytes32 requestorderHash = _requestorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		require(msg.sender == _requestorder.requester);
		m_consumed[requestorderHash] = _requestorder.volume;
		emit ClosedRequestOrder(requestorderHash);
		return true;
	}

}
