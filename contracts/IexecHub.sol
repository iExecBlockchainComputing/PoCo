pragma solidity ^0.4.18;

import './AppHub.sol';
import './WorkerPoolHub.sol';
import './WorkerPool.sol';
import "./Contributions.sol";
import './DatasetHub.sol';
import './TaskRequestHub.sol';
import "./SafeMathOZ.sol";
import "rlc-token/contracts/RLC.sol";

/**
 * @title IexecHub
 */

contract IexecHub
{
	using SafeMathOZ for uint256;
	//uint private constant WORKER_POOL_CREATION_STAKE = 5000; //updated by vote or super admin ?
	//uint private constant APP_CREATION_STAKE         = 5000; //updated by vote or super admin ?
	//uint private constant DATASET_CREATION_STAKE     = 5000; //updated by vote or super admin ?
	//uint private constant WORKER_MEMBERSHIP_STAKE    = 5000; //updated by vote or super admin ?

	struct Account
	{
		uint256 stake;
		uint256 locked;
	}
	/**
	 * Internal data: address to account mapping
	 */
	mapping(address => Account) public m_accounts;
	/**
	 * RLC contract for token transfers.
	 */
	RLC public rlc;

	WorkerPoolHub  workerPoolHub;
	AppHub         appHub;
	DatasetHub     datasetHub;
	TaskRequestHub taskRequestHub;

	mapping (address => address) m_taskWorkerPoolAffectation;
	mapping (address => address) m_taskContributionsAffectation;
	mapping (address => address) m_taskAppAffectation;
	mapping (address => address) m_taskDatasetAffectation;
	mapping (address => address) m_taskRequesterAffectation;
	mapping (address => uint256) m_taskUserCost;
	mapping (address => bool)    m_acceptedTaskRequest;

	//worker => AccurateContributionsCount
	mapping(address => uint256)                  m_workerAccurateContributions;
	//worker => FaultyContributionsCount
	mapping(address => uint256)                  m_workerFaultyContributions;

	/**
	 * Events
	 */
	event TaskRequest(address taskID, address indexed workerPool);
	event TaskAccepted(address taskID, address indexed workerPool, address workContributions);
	event TaskCancelled(address taskID, address indexed workerPool);
	event TaskAborted(address taskID, address workContributions);
	event TaskCompleted(address taskID, address workContributions);

	event CreateWorkerPool(address indexed workerPoolOwner,address indexed workerPool,string  name);
  event OpenWorkerPool(address indexed workerPool);
	event CloseWorkerPool(address indexed workerPool);
	event WorkerPoolUnsubscription(address indexed workerPool, address worker);
  event WorkerPoolSubscription(address indexed workerPool, address worker);

	event FaultyContribution(address taskID, address indexed worker);
	event AccurateContribution(address taskID, address indexed worker);

	event Deposit(address owner, uint256 amount);
	event Withdraw(address owner, uint256 amount);
	event Reward(address user, uint256 amount);
	event Seize(address user, uint256 amount);


	function IexecHub(
		address _tokenAddress,
		address _workerPoolHubAddress,
		address _appHubAddress,
		address _datasetHubAddress,
		address _taskRequestHubAddress)
	public
	{
		rlc = RLC(_tokenAddress);
		workerPoolHub  = WorkerPoolHub (_workerPoolHubAddress );
		appHub         = AppHub        (_appHubAddress        );
		datasetHub     = DatasetHub    (_datasetHubAddress    );
		taskRequestHub = TaskRequestHub(_taskRequestHubAddress);
	}

	function createWorkerPool(
		string _name,
		bool _sgxGuarantee)
	public returns(address createdWorkerPool)
	{
		// add a staking and lock for the msg.sender scheduler. in order to prevent against pool creation spam ?
		//require(lock(msg.sender,WORKER_POOL_CREATION_STAKE)); ?
		address newWorkerPool = workerPoolHub.createWorkerPool(_name,_sgxGuarantee);
		CreateWorkerPool(tx.origin,newWorkerPool,_name);
		return newWorkerPool;
	}

	function createApp(
		string  _appName,
		uint256 _appPrice,
		string  _appParam,
		string  _appUri)
	public returns(address createdApp)
	{
		//require(lock(msg.sender,APP_CREATION_STAKE));		//prevent creation spam ?
		address newApp = appHub.createApp(_appName,_appPrice,_appParam,_appUri);
		return newApp;
	}

	function createDataset(
		string  _datasetName,
		uint256 _datasetPrice,
		string  _datasetParam,
		string  _datasetUri)
	public returns(address createdDataset)
	{
		//require(lock(msg.sender,DATASET_CREATION_STAKE));		//prevent creation spam ?
		address newDataset = datasetHub.createDataset( _datasetName, _datasetPrice, _datasetParam, _datasetUri);
		return newDataset;
	}

	function createTaskRequest(
		address _workerPool,
		address _app,
		address _dataset,
		string  _taskParam,
		uint    _taskCost,
		uint    _askedTrust,
		bool    _dappCallback)
	public returns(address createdTaskRequest)
	{
		// msg.sender = requester

		require(workerPoolHub.isWorkerPoolRegistred(_workerPool));

		//APP
		require(appHub.isAppRegistred     (_app             ));
		require(appHub.isOpen             (_app             ));
		require(appHub.isWorkerPoolAllowed(_app, _workerPool));
		require(appHub.isRequesterAllowed (_app, msg.sender ));

		// userCost at least _taskCost
		uint256 userCost = _taskCost;

		//DATASET
		if (_dataset != address(0))
		{
			require(datasetHub.isDatasetRegistred (_dataset             ));
			require(datasetHub.isOpen             (_dataset             ));
			require(datasetHub.isWorkerPoolAllowed(_dataset, _workerPool));
			require(datasetHub.isAppAllowed       (_dataset, _app       ));
			require(datasetHub.isRequesterAllowed (_dataset, msg.sender ));
			require(appHub.isDatasetAllowed       (_app,     _dataset   ));

			// add optional datasetPrice for userCost
			userCost = userCost.add(datasetHub.getDatasetPrice(_dataset));

		}

		//WORKER_POOL
		WorkerPool aPool = WorkerPool(_workerPool);
		require(aPool.isOpen());

		// add optional appPrice  for userCost
		userCost = userCost.add(appHub.getAppPrice(_app)); // dappPrice

		//msg.sender wanted here. not tx.origin. we can imagine a smart contract have RLC loaded and user can benefit from it.
		if (m_accounts[msg.sender].stake < userCost)
		{
			require(deposit(userCost));
		}
		m_accounts[msg.sender].stake  = m_accounts[msg.sender].stake.sub(userCost);

		address newTaskRequest = taskRequestHub.createTaskRequest(
			msg.sender, // requester
			_workerPool,
			_app,
			_dataset,
			_taskParam,
			_taskCost,
			_askedTrust,
			_dappCallback
		);



		m_taskWorkerPoolAffectation[newTaskRequest] = _workerPool;
		m_taskAppAffectation[newTaskRequest]        = _app;
		m_taskDatasetAffectation[newTaskRequest]    = _dataset;
		m_taskRequesterAffectation[newTaskRequest]  = msg.sender;
		m_taskUserCost[newTaskRequest]              = userCost;
		// address newTaskRequest will the taskID
		TaskRequest(newTaskRequest,_workerPool);
		return newTaskRequest;
	}

	function acceptTask(address _taskID) public  returns (bool)
	{

		WorkerPool aPool = WorkerPool(m_taskWorkerPoolAffectation[_taskID]);
		require(msg.sender == aPool.m_owner());
		address contributions = aPool.acceptTask(_taskID,getTaskCost(_taskID));
		m_taskContributionsAffectation[_taskID] =contributions;
		m_acceptedTaskRequest[_taskID] = true;
		require(taskRequestHub.setAccepted(_taskID));
		TaskAccepted(_taskID,m_taskWorkerPoolAffectation[_taskID],contributions);
		return true;
	}

	function cancelTask(address _taskID) public returns (bool)
	{
		require(msg.sender == m_taskRequesterAffectation[_taskID]);
		require(m_acceptedTaskRequest[_taskID] == false);
		require(reward(msg.sender,m_taskUserCost[_taskID]));
		require(taskRequestHub.setCancelled(_taskID));
		TaskCancelled(_taskID,m_taskWorkerPoolAffectation[_taskID]);
		return true;
	}

	function claimFailedConsensus(address _taskID) public /*only who ? everybody ?*/ returns (bool)
	{
		Contributions aContributions = Contributions(m_taskContributionsAffectation[_taskID]);
		require(aContributions.claimFailedConsensus());
		require(reward(m_taskRequesterAffectation[_taskID],m_taskUserCost[_taskID]));
		//where worker contribution stake and scheduler stake goes ?
		// toto réponds : les stake vont au msg.sender entrainant une chasse aux sorcieres généralisées pour sniffer les workerpools
		//                avec formations de milices organisée pour detecter cela et aussi des groupes de saboteurs. ahahah !
	  require(taskRequestHub.setAborted(_taskID));
		TaskAborted(_taskID,m_taskContributionsAffectation[_taskID]);
		return true;
	}

	function finalizedTask(address _taskID, string _stdout, string _stderr, string _uri, uint256 _schedulerReward) public returns (bool)
	{
		require(msg.sender == m_taskContributionsAffectation[_taskID]);
		require(reward(tx.origin,_schedulerReward));
		address appForTask = m_taskAppAffectation[_taskID];
		uint256 appPrice   = appHub.getAppPrice(appForTask);
		if (appPrice > 0)
		{
			require(reward(appHub.getAppOwner(appForTask),appPrice));
				// to unlock a stake ?
		}
		address datasetForTask = m_taskDatasetAffectation[_taskID];
		if (datasetForTask != address(0))
		{
			uint256 datasetPrice = datasetHub.getDatasetPrice(datasetForTask);
			if (datasetPrice > 0)
			{
				require(reward(datasetHub.getDatasetOwner(datasetForTask),datasetPrice));
				// to unlock a stake ?
			}
		}
    require(taskRequestHub.setResult(_taskID,_stdout,_stderr,_uri));
		// incremente app and dataset reputation too  ?
		TaskCompleted(_taskID,m_taskContributionsAffectation[_taskID]);
		return true;
	}

	function getWorkerStatus(address _worker) public view returns (address workerPool, uint256 accurateContributions, uint256 faultyContributions)
	{
		return (workerPoolHub.getWorkerAffectation(_worker), m_workerAccurateContributions[_worker], m_workerFaultyContributions[_worker]);
	}

	function getTaskCost(address _taskID) public view returns (uint256 taskCost)
	{
		return taskRequestHub.getTaskCost(_taskID);
	}

	function openCloseWorkerPool(address _workerPool,bool open) public returns (bool)
	{
		WorkerPool aPool = WorkerPool(_workerPool);
		require(aPool.getWorkerPoolOwner() == msg.sender);
		if(open)
		{
			require(aPool.switchOnOff(true));
			OpenWorkerPool(_workerPool);
		}
		else
		{
			require(aPool.switchOnOff(false));
			CloseWorkerPool(_workerPool);
		}
		return true;
	}

	function subscribeToPool(address _workerPool) public returns(bool subscribed)
	{
		require(workerPoolHub.subscribeToPool(_workerPool));
	//	lock(msg.sender,WORKER_MEMBERSHIP_STAKE);
    WorkerPoolSubscription(_workerPool, tx.origin);
		return true;
	}

	function unsubscribeToPool(address _workerPool,address _worker) public returns(bool unsubscribed)
	{
		require(workerPoolHub.unsubscribeToPool(_workerPool, _worker));
    WorkerPoolUnsubscription(_workerPool, _worker);
		return true;
	}

	function addFaultyContribution(address _taskID, address _worker) public returns(bool added)
	{
		require(msg.sender == m_taskContributionsAffectation[_taskID]);
		m_workerFaultyContributions[_worker] = m_workerFaultyContributions[_worker].add(1);
		FaultyContribution(_taskID, _worker);
		return true;
	}

	function lockForTask(address _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskContributionsAffectation[_taskID]);
		m_accounts[_user].stake  = m_accounts[_user].stake.sub(_amount);
		m_accounts[_user].locked = m_accounts[_user].locked.add(_amount);
		return true;
	}

	function unlockForTask(address _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskContributionsAffectation[_taskID]);
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		m_accounts[_user].stake  = m_accounts[_user].stake.add(_amount);
		return true;
	}

	function rewardForTask(address _taskID, address _worker, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskContributionsAffectation[_taskID]);
		m_workerAccurateContributions[_worker] = m_workerAccurateContributions[_worker].add(1);
		AccurateContribution(_taskID, _worker);
		require(reward(_worker, _amount));
		return true;
	}

	function seizeForTask(address _taskID, address _worker, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskContributionsAffectation[_taskID]);
		m_workerFaultyContributions[_worker] = m_workerFaultyContributions[_worker].add(1);
		FaultyContribution(_taskID, _worker);
		// ------------- code of seize(address, uint256) inlined here -------------
		m_accounts[_worker].locked = m_accounts[_worker].locked.sub(_amount);
		Seize(_worker, _amount);
		// ------------------------------------------------------------------------
		return true;
	}

	function deposit(uint256 _amount) public returns (bool)
	{
		// TODO: is the transferFrom cancel is SafeMath throws ?
		require(rlc.transferFrom(msg.sender, address(this), _amount));
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.add(_amount);
		Deposit(msg.sender, _amount);
		return true;
	}
	function withdraw(uint256 _amount) public returns (bool)
	{
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.sub(_amount);
		// TODO: is the transferFrom cancel is SafeMath throws ?
		require(rlc.transfer(msg.sender, _amount));
		Withdraw(msg.sender, _amount);
		return true;
	}
	function checkBalance(address _owner) public view returns (uint stake, uint locked)
	{
		return (m_accounts[_owner].stake, m_accounts[_owner].locked);
	}
	/**
	 * Internal function
	 */
	function reward(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].stake = m_accounts[_user].stake.add(_amount);
		Reward(_user,_amount);
		return true;
	}

}
