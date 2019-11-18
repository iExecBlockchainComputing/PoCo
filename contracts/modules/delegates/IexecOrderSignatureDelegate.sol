pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/IexecOrderSignature.sol";


contract IexecOrderSignatureDelegate is IexecOrderSignature, DelegateBase
{
	using IexecODBLibOrders_v4 for bytes32;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.AppOrder;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.DatasetOrder;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.WorkerpoolOrder;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.RequestOrder;

	/***************************************************************************
	 *                            pre-signing tools                            *
	 ***************************************************************************/
	// should be external
	function signAppOrder(IexecODBLibOrders_v4.AppOrder memory _apporder)
	public returns (bool)
	{
		require(msg.sender == App(_apporder.app).owner());
		m_presigned[_apporder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR)] = true;
		return true;
	}

	// should be external
	function signDatasetOrder(IexecODBLibOrders_v4.DatasetOrder memory _datasetorder)
	public returns (bool)
	{
		require(msg.sender == Dataset(_datasetorder.dataset).owner());
		m_presigned[_datasetorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR)] = true;
		return true;
	}

	// should be external
	function signWorkerpoolOrder(IexecODBLibOrders_v4.WorkerpoolOrder memory _workerpoolorder)
	public returns (bool)
	{
		require(msg.sender == Workerpool(_workerpoolorder.workerpool).owner());
		m_presigned[_workerpoolorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR)] = true;
		return true;
	}

	// should be external
	function signRequestOrder(IexecODBLibOrders_v4.RequestOrder memory _requestorder)
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
	function cancelAppOrder(IexecODBLibOrders_v4.AppOrder memory _apporder)
	public returns (bool)
	{
		bytes32 dapporderHash = _apporder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		require(msg.sender == App(_apporder.app).owner());
		m_consumed[dapporderHash] = _apporder.volume;
		emit ClosedAppOrder(dapporderHash);
		return true;
	}

	// should be external
	function cancelDatasetOrder(IexecODBLibOrders_v4.DatasetOrder memory _datasetorder)
	public returns (bool)
	{
		bytes32 dataorderHash = _datasetorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		require(msg.sender == Dataset(_datasetorder.dataset).owner());
		m_consumed[dataorderHash] = _datasetorder.volume;
		emit ClosedDatasetOrder(dataorderHash);
		return true;
	}

	// should be external
	function cancelWorkerpoolOrder(IexecODBLibOrders_v4.WorkerpoolOrder memory _workerpoolorder)
	public returns (bool)
	{
		bytes32 poolorderHash = _workerpoolorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		require(msg.sender == Workerpool(_workerpoolorder.workerpool).owner());
		m_consumed[poolorderHash] = _workerpoolorder.volume;
		emit ClosedWorkerpoolOrder(poolorderHash);
		return true;
	}

	// should be external
	function cancelRequestOrder(IexecODBLibOrders_v4.RequestOrder memory _requestorder)
	public returns (bool)
	{
		bytes32 requestorderHash = _requestorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		require(msg.sender == _requestorder.requester);
		m_consumed[requestorderHash] = _requestorder.volume;
		emit ClosedRequestOrder(requestorderHash);
		return true;
	}

}
