pragma solidity ^0.4.18;

import "./IexecHub.sol";

contract IexecAPI
{

	address  private iexecHubAddress;
	IexecHub private iexecHub;
	event TaskRequestCallback(address taskId, string stdout, string stderr, string uri);

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
		string _taskParam,
		uint   _taskCost,
		uint   _askedTrust,
		bool   _dappCallback)
	public
	{
		iexecHub.createTaskRequest(_workerPool, _app, _dataset, _taskParam, _taskCost, _askedTrust, _dappCallback);
	}

	// TODO add cancel Task function

	function taskRequestCallback(
		address _taskId,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool)
	{
		require(msg.sender == _taskId);
		TaskRequestCallback(_taskId, _stdout, _stderr, _uri);
		return true;
	}
}
