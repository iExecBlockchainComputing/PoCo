pragma solidity ^0.4.18;

import "./OwnableOZ.sol";
import './IexecHubInterface.sol';
import './IexecAPI.sol';

contract TaskRequest is OwnableOZ, IexecHubInterface
{
	address public workerPoolRequested;
	address public dappRequested;
	address public datasetRequested;
	string  public taskParam;
	uint256 public taskCost;
	uint256 public askedTrust;
	bool    public dappCallback;

	//constructor
	function TaskRequest(
		address _iexecHubAddress,
		address _requester,
		address _workerPool,
		address _dapp,
		address _dataset,
		string  _taskParam,
		uint    _taskCost,
		uint    _askedTrust,
		bool    _dappCallback)
	OwnableOZ        (_requester) // owner = _requester
	IexecHubInterface(_iexecHubAddress)
	public
	{
		require(_requester != address(0))

		workerPoolRequested = _workerPool;
		dappRequested       = _dapp;
		datasetRequested    = _dataset;
		taskParam           = _taskParam;
		taskCost            = _taskCost;
		askedTrust          = _askedTrust;
		dappCallback        = _dappCallback;
	}

	//optional dappCallback call can be done
	function taskRequestCallback(
		address _taskId,
		string  _stdout,
		string  _stderr,
		string _uri)
	public returns (bool)
	{
		require(workerPoolRequested == msg.sender);
		require(this == _taskId);
		IexecAPI iexecAPI = IexecAPI(requester);
		require(iexecAPI.taskRequestCallback(_taskId,_stdout,_stderr,_uri));
		return true;
 }



}
