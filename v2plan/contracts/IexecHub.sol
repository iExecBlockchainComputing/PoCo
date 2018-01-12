pragma solidity ^0.4.18;

import './DappHub.sol';
import './WorkerPoolHub.sol';
import './WorkerPool.sol';
import './ProvidersBalance.sol';
import './ProvidersScoring.sol';
import './DatasetHub.sol';
import './TaskRequestHub.sol';
import "./SafeMathOZ.sol";
/**
 * @title IexecHub
 */

contract IexecHub is ProvidersBalance, ProvidersScoring
{
	using SafeMathOZ for uint256;
	uint private constant WORKER_POOL_CREATION_STAKE = 5000; //updated by vote or super admin ?
	uint private constant DAPP_CREATION_STAKE        = 5000; //updated by vote or super admin ?
	uint private constant DATASET_CREATION_STAKE     = 5000; //updated by vote or super admin ?
	uint private constant TASKREQUEST_CREATION_STAKE = 5000; //updated by vote or super admin ?
	uint private constant WORKER_MEMBERSHIP_STAKE    = 5000; //updated by vote or super admin ?
	uint private constant DAPP_PRICE_STAKE_RATIO     = 1;    //updated by vote or super admin ?

	WorkerPoolHub  workerPoolHub;
	DappHub        dappHub;
	DatasetHub     datasetHub;
	TaskRequestHub taskRequestHub;

	mapping (address => address) m_taskPoolAffectation;

	function IexecHub(
		address _tokenAddress,
		address _workerPoolHubAddress,
		address _dappHubAddress,
		address _datasetHubAddress,
		address _taskRequestHubAddress)
	ProvidersBalance(_tokenAddress)
	public
	{
		workerPoolHub  = WorkerPoolHub (_workerPoolHubAddress );
		dappHub        = DappHub       (_dappHubAddress       );
		datasetHub     = DatasetHub    (_datasetHubAddress    );
		taskRequestHub = TaskRequestHub(_taskRequestHubAddress);
	}

	function createWorkerPool(string _name) public returns(address createdWorkerPool)
	{
		// add a staking and lock for the msg.sender scheduler. in order to prevent against pool creation spam ?
		require(lock(msg.sender,WORKER_POOL_CREATION_STAKE));
		address newWorkerPool =workerPoolHub.createWorkerPool(_name);
		return newWorkerPool;
	}

	function createDapp(string _dappName, uint256 _dappPrice, string _dappParam, string _dappUri) public returns(address createdDapp)
	{
		require(lock(msg.sender,DAPP_CREATION_STAKE));		//prevent creation spam ?
		address newDapp =dappHub.createDapp(_dappName,_dappPrice,_dappParam,_dappUri);
		return newDapp;
	}

	function createDataset(string _datasetName, uint256 _datasetPrice, string _datasetParam, string _datasetUri) public returns(address createdDataset)
	{
		require(lock(msg.sender,DATASET_CREATION_STAKE));		//prevent creation spam ?
		address newDataset=datasetHub.createDataset( _datasetName, _datasetPrice, _datasetParam, _datasetUri);
		return newDataset;
	}

	function createTaskRequest(address _workerPool, address _dapp, address _dataset, string _taskParam, uint _taskCost, uint _askedTrust, bool _dappCallback) public returns(address createdTaskRequest)
	{
		// msg.sender = requester

		require(lock(msg.sender,TASKREQUEST_CREATION_STAKE));		//prevent creation spam ?
		require(workerPoolHub.isWorkerPoolRegistred(_workerPool));
		require(dappHub.isDappRegistred(_dapp));
		if (_dataset != address(0))
		{
			require(datasetHub.isDatasetRegistred(_dataset));
		}


		/*
		check needed ?
		WorkerPool aPool = WorkerPool(workerPool);
		require(aPool.isOpen());
		*/

		uint256 dappPrice = dappHub.getDappPrice(_dapp);
		//TODO datasetPrice
		uint256 userCost = _taskCost.add(dappPrice);

		//msg.sender wanted here. not tx.origin. we can imagine a smart contract have RLC loaded and user can benefit from it.
		require(debit(msg.sender,userCost));

		address newTaskRequest =taskRequestHub.createTaskRequest(msg.sender,_workerPool,_dapp,_dataset,_taskParam,_taskCost,_askedTrust,_dappCallback);
		WorkerPool aPool = WorkerPool(_workerPool);
		require(aPool.submitedTask(newTaskRequest));

		m_taskPoolAffectation[newTaskRequest]=_workerPool;
		// address newTaskRequest will the taskID
		return newTaskRequest;
	}

	function finalizedTask(address _taskID) public returns (bool)
	{
	/*	require(msg.sender == m_taskPoolAffectation[_taskID]);
		if(dapps[dapp].dappPrice > 0)
		{
			require(reward(dapps[dapp].provider,dapps[dapp].dappPrice));
			address dappProvider=dapps[msg.sender].provider;
			require(unlock(dappProvider,dapps[dapp].dappPrice*DAPP_PRICE_STAKE_RATIO)); //TODO add SafeMath
		}
		// incremente D(w) or D(s) reputation too  ?
*/
		// TODO option of call back to dapp smart contract asked by user
		return true;
	}

	//TODO add cancelTask function


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

	function scoreWinForTask(address _taskID, address _worker, uint _value) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(scoreWin(_worker,_value));
		return true;
	}

	function scoreLoseForTask(address _taskID, address _worker, uint _value) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(scoreLose(_worker,_value));
		return true;
	}

	function lockForTask(address _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(lock(_user,_amount));
		return true;
	}

	function unlockForTask(address _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(unlock(_user,_amount));
		return true;
	}

	function rewardForTask(address _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(reward(_user,_amount));
		return true;
	}

	function seizeForTask(address _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskPoolAffectation[_taskID]);
		require(seize(_user,_amount));
		return true;
	}


}
