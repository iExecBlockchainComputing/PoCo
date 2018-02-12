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
	// owner => taskRequests count
	mapping(address => uint256)                  m_taskRequestsCountByOwner;
	// owner => index => taskRequest
	mapping(address => mapping(uint => address)) m_taskRequestByOwnerByIndex;
	//  taskRequest => owner
	mapping(address => address)                  m_ownerByTaskRequest;


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
		return m_taskRequestsCountByOwner[_owner];
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

		m_taskRequestsCountByOwner[_requester] = m_taskRequestsCountByOwner[_requester].add(1);
		m_taskRequestByOwnerByIndex[_requester][m_taskRequestsCountByOwner[_requester]] = newTaskRequest;
		m_ownerByTaskRequest[newTaskRequest] = _requester;

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
