pragma solidity ^0.4.21;

import "./IexecHub.sol";

contract IexecAPI
{

	IexecHub private iexecHub;
	address  private iexecHubAddress;
	event WorkOrderCallback(address woid, string stdout, string stderr, string uri);

	// Constructor
	function IexecAPI(address _iexecHubAddress) public
	{
		iexecHubAddress = _iexecHubAddress;
		iexecHub        = IexecHub(iexecHubAddress);
	}

	function createTaskRequest(
		address _workerPool,
		address _app,
		address _dataset,
		string  _workOrderParam,
		uint256 _workReward,
		uint256 _askedTrust,
		bool    _dappCallback,
		address _beneficiary)
	public
	{
		revert(); // TODO: what are we suppose to do ?
		/* iexecHub.createWorkOrder(_workerPool, _app, _dataset, _workOrderParam, _workReward, _askedTrust, _dappCallback, _beneficiary); */
	}

	// TODO add cancel Task function

	function workOrderCallback(
		address _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool)
	{
		require(msg.sender == _woid);
		emit WorkOrderCallback(_woid, _stdout, _stderr, _uri);
		return true;
	}
}
