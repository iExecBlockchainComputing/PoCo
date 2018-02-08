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
	// uint private constant WORKER_POOL_CREATION_STAKE = 5000; // updated by vote or super admin ?
	// uint private constant APP_CREATION_STAKE         = 5000; // updated by vote or super admin ?
	// uint private constant DATASET_CREATION_STAKE     = 5000; // updated by vote or super admin ?
	// uint private constant WORKER_MEMBERSHIP_STAKE    = 5000; // updated by vote or super admin ?

	/**
	 * Datatypes
	 */
	struct Account
	{
		uint256 stake;
		uint256 locked;
	}
	/*
	struct ContributionHistory // for credibility computation, f = failled/total
	{
		uint256 total;
		uint256 failled;
	}
	*/
	struct TaskInfo
	{
		address requesterAffectation;
		address workerPoolAffectation;
		address appAffectation;
		address datasetAffectation;
		address contributionsAffectation;
		uint256 userCost;
	}

	/**
	* RLC contract for token transfers.
	*/
	RLC public rlc;

	/**
	 * Slaves contracts
	 */
	WorkerPoolHub  workerPoolHub;
	AppHub         appHub;
	DatasetHub     datasetHub;
	TaskRequestHub taskRequestHub;

	/**
	 * Internal data
	 */
	mapping(address => Account ) public m_accounts;  // user => stake
	mapping(address => uint256 ) public m_scores;    // user => reputation
	mapping(address => TaskInfo) public m_taskInfos; // task => metadata
	/* ContributionHistory public m_contributionHistory; */


	/**
	 * Events
	 */
	event TaskRequest(address taskID, address indexed workerPool);
	event TaskAccepted(address taskID, address indexed workerPool, address workContributions);
	event TaskCancelled(address taskID, address indexed workerPool);
	event TaskAborted(address taskID, address workContributions);
	event TaskCompleted(address taskID, address workContributions);

	event CreateWorkerPool(address indexed workerPoolOwner, address indexed workerPool, string name);
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

	/**
	 * Constructor
	 */
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

		/* m_contributionHistory.total   = 0; */
		/* m_contributionHistory.failled = 0; */
	}

	/**
	 * Factory
	 */
	function createWorkerPool(
		string _name,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy)
	public returns (address createdWorkerPool)
	{
		// add a staking and lock for the msg.sender scheduler. in order to prevent against pool creation spam ?
		// require(lock(msg.sender, WORKER_POOL_CREATION_STAKE)); ?
		address newWorkerPool = workerPoolHub.createWorkerPool(
			_name,
			_subscriptionLockStakePolicy,
			_subscriptionMinimumStakePolicy,
			_subscriptionMinimumScorePolicy
		);
		CreateWorkerPool(tx.origin, newWorkerPool, _name);
		return newWorkerPool;
	}

	function createAppOrDataset( // App + Dataset to function economy
		string  _name,
		uint256 _price,
		string  _param,
		string  _uri,
		bool    _isApp)
	public returns (address created)
	{
		// require(lock(msg.sender, APP_CREATION_STAKE)); // prevent creation spam ?
		if (_isApp)
		{
			return appHub.createApp(_name, _price, _param, _uri);
		}
		else
		{
			return datasetHub.createDataset(_name, _price, _param, _uri);
		}
	}

	function createTaskRequest(
		address _workerPool,
		address _app,
		address _dataset,
		string  _taskParam,
		uint    _taskCost,
		uint    _askedTrust,
		bool    _dappCallback)
	public returns (address createdTaskRequest)
	{
		// msg.sender = requester

		require(workerPoolHub.isWorkerPoolRegistred(_workerPool));

		// APP
		require(appHub.isAppRegistred     (_app             ));
		require(appHub.isOpen             (_app             ));
		require(appHub.isWorkerPoolAllowed(_app, _workerPool));
		require(appHub.isRequesterAllowed (_app, msg.sender ));

		// userCost at least _taskCost
		uint256 userCost = _taskCost;

		// DATASET
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

		// WORKER_POOL
		WorkerPool aPool = WorkerPool(_workerPool);
		require(aPool.isOpen());

		// add optional appPrice  for userCost
		userCost = userCost.add(appHub.getAppPrice(_app)); // dappPrice

		// msg.sender wanted here. not tx.origin. we can imagine a smart contract have RLC loaded and user can benefit from it.
		if (m_accounts[msg.sender].stake < userCost)
		{
			require(deposit(userCost.sub(m_accounts[msg.sender].stake))); // Only require the deposit of what is missing
		}
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.sub(userCost);

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
		TaskInfo storage taskinfo = m_taskInfos[newTaskRequest];
		taskinfo.requesterAffectation  = msg.sender;
		taskinfo.appAffectation        = _app;
		taskinfo.datasetAffectation    = _dataset;
		taskinfo.workerPoolAffectation = _workerPool;
		taskinfo.userCost              = userCost;
		// address newTaskRequest will the taskID
		TaskRequest(newTaskRequest, _workerPool);
		return newTaskRequest;
	}

	/**
	 * Task life cycle
	 */
	function acceptTask(address _taskID) public  returns (bool)
	{
		TaskInfo storage taskinfo = m_taskInfos[_taskID];
		WorkerPool       pool     = WorkerPool(taskinfo.workerPoolAffectation);

		require(msg.sender == pool.m_owner());
		// require(lock(msg.sender, VALUE_TO_DETERMINE));

		require(taskRequestHub.setAccepted(_taskID));
		taskinfo.contributionsAffectation = pool.acceptTask(_taskID, getTaskCost(_taskID));

		TaskAccepted(_taskID, taskinfo.workerPoolAffectation, taskinfo.contributionsAffectation);
		return true;
	}

	function cancelTask(address _taskID) public returns (bool)
	{
		TaskInfo storage taskinfo = m_taskInfos[_taskID];

		// Why cancelled ? penalty ?
		require(msg.sender == taskinfo.requesterAffectation);
		require(reward(msg.sender, taskinfo.userCost));

		require(taskRequestHub.setCancelled(_taskID));
		// TODO: Something like pool.cancelTask(_taskID); ?

		TaskCancelled(_taskID, taskinfo.workerPoolAffectation);
		return true;
	}

	function claimFailedConsensus(address _taskID) public /*only who ? everybody ?*/ returns (bool)
	{
		TaskInfo storage taskinfo      = m_taskInfos[_taskID];
		Contributions    contributions = Contributions(taskinfo.contributionsAffectation);

		// Who ? contributor / client

		// TODO: cleanup / comment
		require(reward(taskinfo.requesterAffectation, taskinfo.userCost));
		require(taskRequestHub.setAborted(_taskID));
		require(contributions.claimFailedConsensus());

		TaskAborted(_taskID, taskinfo.contributionsAffectation);
		return true;
	}

	function finalizedTask(address _taskID, string _stdout, string _stderr, string _uri, uint256 _schedulerReward) public returns (bool)
	{
		TaskInfo storage taskinfo = m_taskInfos[_taskID];

		require(msg.sender == taskinfo.contributionsAffectation);
		require(reward(tx.origin, _schedulerReward));

		address appForTask = taskinfo.appAffectation;
		uint256 appPrice   = appHub.getAppPrice(appForTask);
		if (appPrice > 0)
		{
			require(reward(appHub.getAppOwner(appForTask), appPrice));
				// to unlock a stake ?
		}

		if (taskinfo.datasetAffectation != address(0))
		{
			uint256 datasetPrice = datasetHub.getDatasetPrice(taskinfo.datasetAffectation);
			if (datasetPrice > 0)
			{
				require(reward(datasetHub.getDatasetOwner(taskinfo.datasetAffectation), datasetPrice));
				// to unlock a stake ?
			}
		}

		require(taskRequestHub.setResult(_taskID, _stdout, _stderr, _uri));
		// incremente app and dataset reputation too  ?
		TaskCompleted(_taskID, taskinfo.contributionsAffectation);
		return true;
	}

	/**
	 * Views
	 */
	function getWorkerStatus(address _worker) public view returns (address workerPool, uint256 workerScore)
	{
		return (workerPoolHub.getWorkerAffectation(_worker), m_scores[_worker]);
	}

	function getTaskCost(address _taskID) public view returns (uint256 taskCost)
	{
		return taskRequestHub.getTaskCost(_taskID);
	}

	/**
	 * WorkerPool management
	 */
	function openCloseWorkerPool(address _workerPool, bool open) public returns (bool)
	{
		WorkerPool pool = WorkerPool(_workerPool);
		require(pool.getWorkerPoolOwner() == msg.sender);
		if(open)
		{
			require(pool.switchOnOff(true));
			OpenWorkerPool(_workerPool);
		}
		else
		{
			require(pool.switchOnOff(false));
			CloseWorkerPool(_workerPool);
		}
		return true;
	}

	/**
	 * Worker subscription
	 */
	function subscribeToPool(address _workerPool) public returns (bool subscribed)
	{
		require(m_scores[msg.sender]         >= WorkerPool(_workerPool).m_subscriptionMinimumScorePolicy());
		require(m_accounts[msg.sender].stake >= WorkerPool(_workerPool).m_subscriptionMinimumStakePolicy());
		require(lock(msg.sender, WorkerPool(_workerPool).m_subscriptionLockStakePolicy()));
		require(workerPoolHub.subscribeToPool(_workerPool));
		WorkerPoolSubscription(_workerPool, tx.origin);
		return true;
	}

	function unsubscribeToPool(address _workerPool, address _worker) public returns (bool unsubscribed)
	{
		require(unlock(_worker, WorkerPool(_workerPool).m_subscriptionLockStakePolicy()));
		// workerPoolHub.unsubscribeToPool checks tx.origin (only worker and workerPool manager are allowed)
		require(workerPoolHub.unsubscribeToPool(_workerPool, _worker));
		WorkerPoolUnsubscription(_workerPool, _worker);
		return true;
	}

	/**
	 * Stake, reward and penalty functions
	 */
	function lockForTask(address _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskInfos[_taskID].contributionsAffectation);
		require(lock(_user, _amount));
		return true;
	}

	function unlockForTask(address _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskInfos[_taskID].contributionsAffectation);
		require(unlock(_user, _amount));
		return true;
	}

	function rewardForTask(address _taskID, address _worker, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskInfos[_taskID].contributionsAffectation);
		m_scores[_worker] = m_scores[_worker].add(1);
		AccurateContribution(_taskID, _worker);
		// ----------------------- reward(address, uint256) -----------------------
		require(reward(_worker, _amount));
		// ------------------------------------------------------------------------
		return true;
	}

	function seizeForTask(address _taskID, address _worker, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskInfos[_taskID].contributionsAffectation);
		m_scores[_worker] = m_scores[_worker].sub(m_scores[_worker].min256(50));
		FaultyContribution(_taskID, _worker);
		// ------------- code of seize(address, uint256) inlined here -------------
		m_accounts[_worker].locked = m_accounts[_worker].locked.sub(_amount);
		Seize(_worker, _amount);
		// ------------------------------------------------------------------------
		return true;
	}

	/**
	 * Wallet methods: public
	 */
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
	 * Wallet methods: Internal
	 */
	function reward(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].stake = m_accounts[_user].stake.add(_amount);
		Reward(_user, _amount);
		return true;
	}
	/**
	 * function seize(address _user, uint256 _amount) internal returns (bool)
	 * has been inlined in seizeForTask (not called anywhere else)
	 */
	function lock(address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = m_accounts[_user].stake.sub(_amount);
		m_accounts[_user].locked = m_accounts[_user].locked.add(_amount);
		return true;
	}

	function unlock(address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		m_accounts[_user].stake  = m_accounts[_user].stake.add(_amount);
		return true;
	}

}
