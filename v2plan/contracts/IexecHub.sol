pragma solidity ^0.4.18;

import './AppHub.sol';
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
	uint private constant APP_CREATION_STAKE        = 5000; //updated by vote or super admin ?
	uint private constant DATASET_CREATION_STAKE     = 5000; //updated by vote or super admin ?
	uint private constant TASKREQUEST_CREATION_STAKE = 5000; //updated by vote or super admin ?
	uint private constant WORKER_MEMBERSHIP_STAKE    = 5000; //updated by vote or super admin ?
	uint private constant APP_PRICE_STAKE_RATIO     = 1;    //updated by vote or super admin ?

	WorkerPoolHub  workerPoolHub;
	AppHub         appHub;
	DatasetHub     datasetHub;
	TaskRequestHub taskRequestHub;

	mapping (address => address) m_taskPoolAffectation;

	function IexecHub(
		address _tokenAddress,
		address _workerPoolHubAddress,
		address _appHubAddress,
		address _datasetHubAddress,
		address _taskRequestHubAddress)
	ProvidersBalance(_tokenAddress)
	public
	{
		workerPoolHub  = WorkerPoolHub (_workerPoolHubAddress );
		appHub        = AppHub       (_appHubAddress       );
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

	function createApp(string _appName, uint256 _appPrice, string _appParam, string _appUri) public returns(address createdApp)
	{
		require(lock(msg.sender,APP_CREATION_STAKE));		//prevent creation spam ?
		address newApp =appHub.createApp(_appName,_appPrice,_appParam,_appUri);
		return newApp;
	}

	function createDataset(string _datasetName, uint256 _datasetPrice, string _datasetParam, string _datasetUri) public returns(address createdDataset)
	{
		require(lock(msg.sender,DATASET_CREATION_STAKE));		//prevent creation spam ?
		address newDataset=datasetHub.createDataset( _datasetName, _datasetPrice, _datasetParam, _datasetUri);
		return newDataset;
	}

	function createTaskRequest(address _workerPool, address _app, address _dataset, string _taskParam, uint _taskCost, uint _askedTrust, bool _dappCallback) public returns(address createdTaskRequest)
	{
		// msg.sender = requester

		require(lock(msg.sender,TASKREQUEST_CREATION_STAKE));		//prevent creation spam ?
		require(workerPoolHub.isWorkerPoolRegistred(_workerPool));

		//APP
		require(appHub.isAppRegistred(_app));
		require(appHub.isOpen(_app));
		require(appHub.isWorkerPoolAllowed(_app,_workerPool));
		require(appHub.isRequesterAllowed(_app,msg.sender));

		//DATASET
		if (_dataset != address(0))
		{
			require(datasetHub.isDatasetRegistred(_dataset));
			require(datasetHub.isOpen(_dataset));
			require(datasetHub.isWorkerPoolAllowed(_dataset,_workerPool));
			require(datasetHub.isAppAllowed(_dataset,_app));
			require(datasetHub.isRequesterAllowed(_dataset,msg.sender));
			require(appHub.isDatasetAllowed(_app,_dataset));
		}

		//WORKER_POOL
		WorkerPool aPool = WorkerPool(_workerPool);
		require(aPool.isOpen());


		uint256 dappPrice = appHub.getAppPrice(_app);
		//TODO datasetPrice
		uint256 userCost = _taskCost.add(dappPrice);

		//msg.sender wanted here. not tx.origin. we can imagine a smart contract have RLC loaded and user can benefit from it.
		require(debit(msg.sender,userCost));

		address newTaskRequest =taskRequestHub.createTaskRequest(msg.sender,_workerPool,_app,_dataset,_taskParam,_taskCost,_askedTrust,_dappCallback);

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
			require(unlock(dappProvider,dapps[dapp].dappPrice*APP_PRICE_STAKE_RATIO)); //TODO add SafeMath
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
		require(aPool.open());
		lock(msg.sender,WORKER_POOL_CREATION_STAKE);
		return true;
	}

	function closePool(address _workerPool) public returns (bool)
	{
		WorkerPool aPool= WorkerPool(_workerPool);
		require(aPool.getWorkerPoolOwner() == msg.sender);
		require(aPool.close());
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
