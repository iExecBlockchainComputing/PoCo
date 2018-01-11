pragma solidity ^0.4.18;
import "./TaskRequest.sol";
import "rlc-token/contracts/Ownable.sol";
import "./SafeMathOZ.sol";
contract TaskRequestHub is Ownable // is Owned by IexecHub
{

	using SafeMathOZ for uint256;

  event CreateTaskRequest(address taskRequestOwner, address taskRequest,  address indexed workerPool, address indexed dapp, address indexed dataset, string taskParam, uint taskCost, uint askedTrust, bool dappCallback);

  // owner => taskRequests count
  mapping (address => uint256) m_taskRequestsCountByOwner;

  // owner => index => taskRequest
  mapping (address => mapping (uint => address)) m_taskRequestByOwnerByIndex;

  //  taskRequest => owner
  mapping (address => address) m_ownerByTaskRequest;

  function getTaskRequestsCount(address _owner) view public returns (uint256)
  {
    return m_taskRequestsCountByOwner[_owner];
  }

  function getTaskRequest(address _owner,uint256 _index) view public returns (address)
  {
    return m_taskRequestByOwnerByIndex[_owner][_index];
  }

  function getTaskRequestOwner(address _taskRequest) view public returns (address)
  {
    return m_ownerByTaskRequest[_taskRequest];
  }

  function isTaskRequestRegistred(address _taskRequest) view public returns (bool)
  {
    return m_ownerByTaskRequest[_taskRequest] != 0x0;
  }

  function createTaskRequest(address _requester,address _workerPool, address _dapp, address _dataset, string _taskParam, uint _taskCost, uint _askedTrust, bool _dappCallback) public onlyOwner /*owner == IexecHub*/ returns(address createdTaskRequest)
  {
    // _requester == owner of the task
    // msg.sender == IexecHub
    address newTaskRequest = new TaskRequest(msg.sender,_requester, _workerPool, _dapp,  _dataset,  _taskParam,  _taskCost,  _askedTrust, _dappCallback);
    m_taskRequestsCountByOwner[_requester]=m_taskRequestsCountByOwner[_requester].add(1);
    m_taskRequestByOwnerByIndex[_requester][m_taskRequestsCountByOwner[_requester]] = newTaskRequest;
    m_ownerByTaskRequest[newTaskRequest]= _requester;
    CreateTaskRequest(_requester,newTaskRequest,_workerPool, _dapp,  _dataset,  _taskParam,  _taskCost,  _askedTrust, _dappCallback);
    return newTaskRequest;
  }


}
