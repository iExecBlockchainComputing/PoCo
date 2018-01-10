pragma solidity ^0.4.18;

import './DappHub.sol';
import './WorkerPoolHub.sol';
import './Stake.sol';
import './Scoring.sol';

/**
 * @title Poco
 */

contract Poco is DappHub, Stake , Scoring //, poco is also a WorkerPoolHub but removed because of bytcodes contract limitation
{
	uint private constant WORKER_POOL_CREATION_STAKE = 5000; //updated by vote or super admin ?
	uint private constant WORKER_MEMBERSHIP_STAKE = 5000; //updated by vote or super admin ?
	uint private constant DAPP_PRICE_STAKE_RATIO = 1; //updated by vote or super admin ?

	WorkerPoolHub  workerPoolHub;

	mapping (bytes32 => address) m_taskPoolAffectation;

	function Poco(address _tokenAddress, address _workerPoolHubAddress ) Stake(_tokenAddress) public
	{
		workerPoolHub = WorkerPoolHub(_workerPoolHubAddress);
	}

	//event SubmitTask(address indexed user, address indexed workerPool, address indexed dapp, string taskParam, uint taskCost);

	function submitTask(address workerPool, string taskParam, uint taskCost, uint askedTrust, bool dappCallback) onlyDappRegistered public returns (bool)
	{
		// msg.sender is D(s)
		// tx.origin is U(w)

		require(taskCost >0); // to check ?

		bytes32 taskID   = sha256(msg.data, block.number);
		WorkerPool aPool = WorkerPool(workerPool);

		require(aPool.isOpen());

		//you must be on the withe list of the worker pool to subribe.
		uint256 dappPrice = dapps[msg.sender].dappPrice;
		if(dapps[msg.sender].dappPrice > 0)
		{
			address dappProvider = dapps[msg.sender].provider;
			require(lock(dappProvider,dappPrice*DAPP_PRICE_STAKE_RATIO)); //TODO add SafeMath
		}
		uint256 userCost = dappPrice + taskCost;

		//reward = taskCost + dappPrice;

		//lock user RLC
		require(debit(tx.origin,userCost));

		require(aPool.submitedTask(taskID,msg.sender,taskParam, taskCost, askedTrust, dappCallback ));

		//needed for completeTask and pay dappProvider at the end.
		m_taskPoolAffectation[taskID] = workerPool;
		//TODO LOG SubmitTask(taskID,tx.origin, workerPool, msg.sender, userCost, taskParam, dappCallback);

		return true;
	}

	function finalizedTask(bytes32 _taskID,address dapp) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		if(dapps[dapp].dappPrice > 0)
		{
			require(reward(dapps[dapp].provider,dapps[dapp].dappPrice));
			address dappProvider=dapps[msg.sender].provider;
			require(unlock(dappProvider,dapps[dapp].dappPrice*DAPP_PRICE_STAKE_RATIO)); //TODO add SafeMath
		}
		// incremente D(w) or D(s) reputation too  ?
		return true;
	}

	function createPool(string name) public returns(address poolAddress)
	{
		// add a staking and lock for the msg.sender scheduler. in order to prevent against pool creation spam ?
		require(lock(msg.sender,WORKER_POOL_CREATION_STAKE));
		address newPool =workerPoolHub.createPool(name);
		return newPool;
	}

	function openPool(address _workerPool) public returns (bool)
	{
		WorkerPool aPool = WorkerPool(_workerPool);
		require(aPool.getWorkerPoolOwner() == msg.sender);
		require(aPool.openPool());
		lock(msg.sender,WORKER_POOL_CREATION_STAKE);
		return true;
	}

	function closePool(address _workerPool) public returns (bool)
	{
		WorkerPool aPool= WorkerPool(_workerPool);
		require(aPool.getWorkerPoolOwner() == msg.sender);
		require(aPool.closePool());
		unlock(msg.sender,WORKER_POOL_CREATION_STAKE);
		return true;
	}

	function subscribeToPool(address _workerPool) public returns(bool subscribed)
	{
		require(workerPoolHub.subscribeToPool(_workerPool));
		lock(msg.sender,WORKER_MEMBERSHIP_STAKE);
		return true;
	}

	function unsubscribeToPool(address _workerPool) public returns(bool unsubscribed)
	{
		require(workerPoolHub.unsubscribeToPool(_workerPool));
		unlock(msg.sender,WORKER_MEMBERSHIP_STAKE);
		return true;
	}

	// add a scoreWinLooseTask for S(w) S(s) too ?

	function scoreWinForTask(bytes32 _taskID,address _worker,uint _value) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(scoreWin(_worker,_value));
		return true;
	}

	function scoreLoseForTask(bytes32 _taskID,address _worker,uint _value) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(scoreLose(_worker,_value));
		return true;
	}

	function lockForTask(bytes32 _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(lock(_user,_amount));
		return true;
	}

	function unlockForTask(bytes32 _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(unlock(_user,_amount));
		return true;
	}

	function rewardForTask(bytes32 _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(reward(_user,_amount));
		return true;
	}

	function seizeForTask(bytes32 _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(seize(_user,_amount));
		return true;
	}

}
