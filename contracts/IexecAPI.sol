pragma solidity ^0.4.18;

import "./IexecHub.sol";

contract IexecAPI
{

	address  private iexecHubAddress;
	IexecHub private iexecHub;
	event WorkOrderCallback(address woid, string stdout, string stderr, string uri);

	// Constructor
	function IexecAPI(address _iexecHubAddress) public
	{
		iexecHubAddress = _iexecHubAddress;
		iexecHub = IexecHub(iexecHubAddress);
	}

	function createTaskRequest(
		address _workerPool,
		address _app,
		address _dataset,
		string _workOrderParam,
		uint   _workReward,
		uint   _askedTrust,
		bool   _dappCallback,
		address _beneficiary)
	public
	{
		iexecHub.createWorkOrder(_workerPool, _app, _dataset, _workOrderParam, _workReward, _askedTrust, _dappCallback,_beneficiary);
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
		WorkOrderCallback(_woid, _stdout, _stderr, _uri);
		return true;
	}
}
