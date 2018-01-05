pragma solidity ^0.4.18;

import './interfaces/ITaskRegistry.sol';
/**
 * @title Poco
 */
contract Poco is DappHub , WorkerPoolHub, Stake , Scoring {


  mapping (bytes32 => Task) m_taskPoolAffectation;

  function Poco(address _tokenAddress) Stake(_tokenAddress) public
	{

	}

  //event SubmitTask(address indexed user, address indexed workerPool, address indexed dapp, string taskParam, uint taskCost);

  function submitTask(address workerPool, string taskParam, uint taskCost, uint askedTrust, bool dappCallback) onlyDappRegistered public returns (bool){
     // msg.sender is D(s)
     // tx.origin is U(w)

    require(taskCost >0); // to check ?

    bytes32 taskID = sha3(msg.data, block.number);
    WorkerPool aPool= WorkerPool(workerPool);

    // TODO check aPool is presenty in this poco WorkerPoolHub

    //you must be on the withe list of the worker pool to subribe.
    uint256 dappPrice =dappRegistry[msg.sender].dappPrice;

    uint256 userCost=dappPrice + taskCost ;

    //reward = taskCost + dappPrice

    //lock user RLC
    require(debit(tx.origin,userCost));

    require(aPool.submitedTask(taskID,msg.sender,taskParam, taskCost, askedTrust, dappCallback )));

    //needed for completeTask and pay dappProvider at the end.
    m_taskPoolAffectation[taskID]=workerPool;

    SubmitTask(bytes32 taskID,tx.origin, workerPool, msg.sender, userCost, taskParam, dappCallback);

    return true;
  }

  function finalizedTask(bytes32 _taskID,address dapp) returns (bool){
    required(msg.sender == m_taskPoolAffectation[_taskID]);
    if(dappRegistry[msg.sender].dappPrice > 0){
      require(reward(dappRegistry[msg.sender].provider,dappRegistry[msg.sender].dappPrice));
    }
    // incremente D(w) or D(s) reputation too  ?
    return true;
  }

  // add a scoreWinLooseTask for S(w) S(s) too ?

  function scoreWinTask(bytes32 _taskID,address _worker,uint _value)returns (bool){
    require(msg.sender == m_taskPoolAffectation[_taskID]);
    require(scoreWin(_worker,_value));
    return true;
  }

  function scoreLoseTask(bytes32 _taskID,address _worker,uint _value)returns (bool){
    require(msg.sender == m_taskPoolAffectation[_taskID]);
    require(scoreLose(_worker,_value));
    return true;
  }


}
