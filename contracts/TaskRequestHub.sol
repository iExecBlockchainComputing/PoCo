pragma solidity ^0.4.18;

import "./TaskRequest.sol";
import "./OwnableOZ.sol";
import "./SafeMathOZ.sol";

contract TaskRequestHub is OwnableOZ // is Owned by IexecHub
{

	using SafeMathOZ for uint256;

	/**
	 * Members
	 */
	mapping(address => uint256)                  m_taskRequestCountByOwner;
	mapping(address => mapping(uint => address)) m_taskRequestByOwnerByIndex;
	mapping(address => address)                  m_ownerByTaskRequest;

	/**
	 * Events
	 */
	event CreateTaskRequest(
		address taskRequestOwner,
		address taskRequest,
		address indexed workerPool,
		address indexed app,
		address indexed dataset,
		string  taskParam,
		uint    taskCost,
		uint    askedTrust,
		bool    dappCallback
	);

	/**
	 * Constructor
	 */
	function TaskRequestHub() public
	{
	}

	/**
	 * Methods
	 */
	function getTaskRequestsCount(address _owner) public view returns (uint256)
	{
		return m_taskRequestCountByOwner[_owner];
	}

	function getTaskRequest(address _owner, uint256 _index) public view returns (address)
	{
		return m_taskRequestByOwnerByIndex[_owner][_index];
	}

	function getTaskRequestOwner(address _taskRequest) public view returns (address)
	{
		return m_ownerByTaskRequest[_taskRequest];
	}

	function isTaskRequestRegistred(address _taskRequest) public view returns (bool)
	{
		return m_ownerByTaskRequest[_taskRequest] != 0x0;
	}

	function addTaskRequest(address _owner, address _taskRequest) internal
	{
		uint id = m_taskRequestCountByOwner[_owner];
		m_taskRequestCountByOwner  [_owner]       = id.add(1);
		m_taskRequestByOwnerByIndex[_owner][id]   = _taskRequest;
		m_ownerByTaskRequest       [_taskRequest] = _owner;
	}

	function createTaskRequest(
		address _requester,
		address _workerPool,
		address _app,
		address _dataset,
		string  _taskParam,
		uint    _taskCost,
		uint    _askedTrust,
		bool    _dappCallback,
		address _beneficiary)
	public onlyOwner /*owner == IexecHub*/ returns (address createdTaskRequest)
	{
		// _requester == owner of the task
		// msg.sender == IexecHub
		address newTaskRequest = new TaskRequest(
			msg.sender,
			_requester,
			_workerPool,
			_app,
			_dataset,
			_taskParam,
			_taskCost,
			_askedTrust,
			_dappCallback,
			_beneficiary
		);
		addTaskRequest(tx.origin, newTaskRequest);

		CreateTaskRequest(
			_requester,
			newTaskRequest,
			_workerPool,
			_app,
			_dataset,
			_taskParam,
			_taskCost,
			_askedTrust,
			_dappCallback
		);

		return newTaskRequest;
	}

	function getTaskCost(address _taskId) public view returns (uint256)
	{
		return TaskRequest(_taskId).m_taskCost();
	}

	function setResult(address _taskId, string _stdout, string _stderr, string _uri) public onlyOwner /*owner == IexecHub*/ returns (bool)
	{
		return TaskRequest(_taskId).setResult(_stdout, _stderr, _uri);
	}

	function setAccepted(address _taskId) public onlyOwner /*owner == IexecHub*/ returns (bool)
	{
		return TaskRequest(_taskId).setAccepted();
	}

	function setCancelled(address _taskId) public onlyOwner /*owner == IexecHub*/ returns (bool)
	{
		return TaskRequest(_taskId).setCancelled();
	}

	function setAborted(address _taskId) public onlyOwner /*owner == IexecHub*/ returns (bool)
	{
		return TaskRequest(_taskId).setAborted();
	}


}
