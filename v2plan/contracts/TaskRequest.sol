pragma solidity ^0.4.18;
import './IexecHub.sol';
import './IexecAPI.sol';
contract TaskRequest{

  address public requester;
  address private iexecHubAddress;
  IexecHub private iexecHub;


  address public workerPoolRequested;
  address public dappRequested;
  address public datasetRequested;
  string public taskParam;
  uint256 public taskCost;
  uint256 public askedTrust;
  bool public dappCallback;

  modifier onlyOwner() {
    require(msg.sender == requester);
    _;
  }

  modifier onlyIexecHub()
  {
    require(msg.sender == iexecHubAddress);
    _;
  }

  //constructor
  function TaskRequest(address _iexecHubAddress , address _requester, address _workerPool, address _dapp, address _dataset, string _taskParam, uint _taskCost, uint _askedTrust, bool _dappCallback) public
  {
    requester = _requester;
    iexecHubAddress  = _iexecHubAddress;
    iexecHub         = IexecHub(iexecHubAddress);

    workerPoolRequested=_workerPool;
    dappRequested=_dapp;
    datasetRequested=_dataset;
    taskParam=_taskParam;
    taskCost=_taskCost;
    askedTrust=_askedTrust;
    dappCallback=_dappCallback;
  }

  //optional dappCallback call can be done
  function taskRequestCallback(address _taskId, string _stdout,string _stderr, string _uri) public returns (bool){
     require( workerPoolRequested == msg.sender);
     require( this == _taskId);
     IexecAPI iexecAPI = IexecAPI(requester);
     require(iexecAPI.taskRequestCallback(_taskId,_stdout,_stderr,_uri));
     return true;
 }



}
