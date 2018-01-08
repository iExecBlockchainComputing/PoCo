pragma solidity ^0.4.18;

import './DappHub.sol';
import './WorkerPoolHub.sol';
import './Stake.sol';
import './Scoring.sol';
import './interfaces/IPoco.sol';
/**
 * @title Poco
 */
contract Poco is IPoco, DappHub , WorkerPoolHub, Stake , Scoring {


  mapping (bytes32 => address) m_taskPoolAffectation;

  function Poco(address _tokenAddress) Stake(_tokenAddress) public
	{

	}

  //event SubmitTask(address indexed user, address indexed workerPool, address indexed dapp, string taskParam, uint taskCost);

  function submitTask(address workerPool, string taskParam, uint taskCost, uint askedTrust, bool dappCallback) onlyDappRegistered public returns (bool){
     // msg.sender is D(s)
     // tx.origin is U(w)

    require(taskCost >0); // to check ?

    bytes32 taskID = sha256(msg.data, block.number);
    WorkerPool aPool= WorkerPool(workerPool);

    // TODO check aPool is presenty in this poco WorkerPoolHub

    //you must be on the withe list of the worker pool to subribe.
    uint256 dappPrice =dapps[msg.sender].dappPrice;

    uint256 userCost=dappPrice + taskCost ;

    //reward = taskCost + dappPrice

    //lock user RLC
    require(debit(tx.origin,userCost));

    require(aPool.submitedTask(taskID,msg.sender,taskParam, taskCost, askedTrust, dappCallback ));

    //needed for completeTask and pay dappProvider at the end.
    m_taskPoolAffectation[taskID]=workerPool;
    //TODO LOG SubmitTask(taskID,tx.origin, workerPool, msg.sender, userCost, taskParam, dappCallback);

    return true;
  }

  function finalizedTask(bytes32 _taskID,address dapp) public returns (bool){
    require(msg.sender == m_taskPoolAffectation[_taskID]);
    if(dapps[msg.sender].dappPrice > 0){
      require(reward(dapps[msg.sender].provider,dapps[msg.sender].dappPrice));
    }
    // incremente D(w) or D(s) reputation too  ?
    return true;
  }

  // add a scoreWinLooseTask for S(w) S(s) too ?

  function scoreWinForTask(bytes32 _taskID,address _worker,uint _value) public returns (bool){
    require(msg.sender == m_taskPoolAffectation[_taskID]);
    require(scoreWin(_worker,_value));
    return true;
  }

  function scoreLoseForTask(bytes32 _taskID,address _worker,uint _value) public returns (bool){
    require(msg.sender == m_taskPoolAffectation[_taskID]);
    require(scoreLose(_worker,_value));
    return true;
  }


  function lockForTask(bytes32 _taskID, address _user, uint _amount) public returns (bool){
    require(msg.sender == m_taskPoolAffectation[_taskID]);
    require(lock(_user,_amount));
    return true;
  }

  function unlockForTask(bytes32 _taskID, address _user, uint _amount) public returns (bool){
    require(msg.sender == m_taskPoolAffectation[_taskID]);
    require(unlock(_user,_amount));
    return true;
  }

  function rewardForTask(bytes32 _taskID, address _user, uint _amount) public returns (bool){
    require(msg.sender == m_taskPoolAffectation[_taskID]);
    require(reward(_user,_amount));
    return true;
  }

  function seizeForTask(bytes32 _taskID, address _user, uint _amount) public returns (bool){
    require(msg.sender == m_taskPoolAffectation[_taskID]);
    require(seize(_user,_amount));
    return true;
  }


}
