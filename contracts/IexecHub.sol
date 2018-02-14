pragma solidity ^0.4.18;

import './AppHub.sol';
import './WorkerPoolHub.sol';
import './WorkerPool.sol';
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
	struct ContributionHistory // for credibility computation, f = failled/total
	{
		uint256 success;
		uint256 failled;
	}
	struct TaskInfo
	{
		address requesterAffectation;
		address workerPoolAffectation;
		address appAffectation;
		address datasetAffectation;
		uint256 userCost;
	}

	/**
	* RLC contract for token transfers.
	*/
	RLC public rlc;

	/**
	 * Slaves contracts
	 */
	AppHub         appHub;
	DatasetHub     datasetHub;
	TaskRequestHub taskRequestHub;
	WorkerPoolHub  workerPoolHub;

	/**
	 * Internal data
	 */
	mapping(address => Account ) public m_accounts;  // user => stake
	mapping(address => uint256 ) public m_scores;    // user => reputation
	mapping(address => TaskInfo) public m_taskInfos; // task => metadata
	ContributionHistory          public m_contributionHistory;


	/**
	 * Events
	 */
	event TaskRequest(address taskID, address taskRequestOwner, address indexed workerPool, address indexed app, address indexed dataset);
	event TaskAccepted(address taskID, address indexed workerPool);
	event TaskCancelled(address taskID, address indexed workerPool);
	event TaskAborted(address taskID, address workerPool);
	event TaskCompleted(address taskID, address workerPool);

	event CreateApp(address indexed appOwner,address indexed app,string  appName,uint256 appPrice,string  appParams);
	event CreateDataset(address indexed datasetOwner, address indexed dataset, string  datasetName, uint256 datasetPrice, string  datasetParams);

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

		m_contributionHistory.success = 0;
		m_contributionHistory.failled = 0;
	}

	/**
	 * Factory
	 */
	function createWorkerPool(
		string  _name,
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

	function createDataset(
		string  _datasetName,
		uint256 _datasetPrice,
		string  _datasetParams)
	public returns (address createdDataset)
	{
		address newDataset = datasetHub.createDataset(
			_datasetName,
			_datasetPrice,
			_datasetParams
		);
		CreateDataset(tx.origin, newDataset, _datasetName, _datasetPrice, _datasetParams);
		return newDataset;
	}

	function createApp(
		string  _appName,
		uint256 _appPrice,
		string  _appParams)
	public returns (address createdApp)
	{
		address newApp = appHub.createApp(
			_appName,
			_appPrice,
			_appParams
		);
		CreateApp(tx.origin, newApp, _appName, _appPrice, _appParams);
		return newApp;
	}

	function createTaskRequest(
		address _workerPool,
		address _app,
		address _dataset,
		string  _taskParam,
		uint    _taskReward,
		uint    _askedTrust,
		bool    _dappCallback,
		address _beneficiary)
	public returns (address createdTaskRequest)
	{
		// msg.sender = requester

		if (_workerPool != address(0)) // address(0) → any workerPool
		{
			require(workerPoolHub.isWorkerPoolRegistred(_workerPool            ));
			require(workerPoolHub.isOpen               (_workerPool            ));
			require(workerPoolHub.isAppAllowed         (_workerPool, _app      ));
			require(workerPoolHub.isDatasetAllowed     (_workerPool, _dataset  ));
			/* require(workerPoolHub.isRequesterAllowed   (_workerPool, msg.sender)); */
		}

		// APP
		require(appHub.isAppRegistred     (_app             ));
		require(appHub.isOpen             (_app             ));
		require(appHub.isDatasetAllowed   (_app, _dataset   ));
		require(appHub.isRequesterAllowed (_app, msg.sender ));
		require(appHub.isWorkerPoolAllowed(_app, _workerPool));

		// Price to pay by the user, initialized with reward
		uint256 userCost = _taskReward;
		// add optional appPrice to userCost
		userCost = userCost.add(appHub.getAppPrice(_app)); // dappPrice

		// DATASET
		if (_dataset != address(0)) // address(0) → no dataset
		{
			require(datasetHub.isDatasetRegistred (_dataset             ));
			require(datasetHub.isOpen             (_dataset             ));
			require(datasetHub.isAppAllowed       (_dataset, _app       ));
			require(datasetHub.isRequesterAllowed (_dataset, msg.sender ));
			require(datasetHub.isWorkerPoolAllowed(_dataset, _workerPool));

			// add optional datasetPrice for userCost
			userCost = userCost.add(datasetHub.getDatasetPrice(_dataset));
		}

		// msg.sender wanted here. not tx.origin. we can imagine a smart contract have RLC loaded and user can benefit from it.
		if (m_accounts[msg.sender].stake < userCost)
		{
			require(deposit(userCost.sub(m_accounts[msg.sender].stake))); // Only require the deposit of what is missing
		}

		address newTaskRequest = taskRequestHub.createTaskRequest(
			msg.sender, // requester
			_workerPool,
			_app,
			_dataset,
			_taskParam,
			_taskReward,
			_askedTrust,
			_dappCallback,
			_beneficiary
		);
		TaskInfo storage taskinfo = m_taskInfos[newTaskRequest];
		taskinfo.requesterAffectation  = msg.sender;
		taskinfo.appAffectation        = _app;
		taskinfo.datasetAffectation    = _dataset;
		taskinfo.workerPoolAffectation = _workerPool;
		taskinfo.userCost              = userCost;

		require(lock(taskinfo.requesterAffectation, taskinfo.userCost)); // LOCK THE FUNDS FOR PAYMENT

		// WORKER_POOL
		require(WorkerPool(_workerPool).receivedTask(newTaskRequest, _taskReward, _app, _dataset));

		// address newTaskRequest will the taskID
		TaskRequest(newTaskRequest, msg.sender, _workerPool, _app, _dataset);
		return newTaskRequest;
	}

	/**
	 * Task life cycle
	 */
	function acceptTask(address _taskID) public  returns (bool)
	{

		TaskInfo storage taskinfo = m_taskInfos[_taskID];
		if (taskinfo.workerPoolAffectation == address(0))
		{
			taskinfo.workerPoolAffectation = msg.sender; // set the workerPoolAffectation in case 'any'
			require(appHub.isWorkerPoolAllowed    (taskinfo.appAffectation,     taskinfo.workerPoolAffectation));
			require(datasetHub.isWorkerPoolAllowed(taskinfo.datasetAffectation, taskinfo.workerPoolAffectation));
		}
		else
		{
			require(taskinfo.workerPoolAffectation == msg.sender);
		}

		require(taskRequestHub.setAccepted(_taskID));
		// require(lock(msg.sender, VALUE_TO_DETERMINE)); // TODO: scheduler stake

		TaskAccepted(_taskID, taskinfo.workerPoolAffectation);
		return true;
	}

	function cancelTask(address _taskID) public returns (bool)
	{
		TaskInfo storage taskinfo = m_taskInfos[_taskID];

		// Why cancelled ? penalty ?
		require(msg.sender == taskinfo.requesterAffectation);
		require(unlock(taskinfo.requesterAffectation, taskinfo.userCost)); // UNLOCK THE FUNDS FOR REINBURSEMENT

		require(taskRequestHub.setCancelled(_taskID));
		require(WorkerPool(taskinfo.workerPoolAffectation).cancelTask(_taskID));
		TaskCancelled(_taskID, taskinfo.workerPoolAffectation);
		return true;
	}

	function claimFailedConsensus(address _taskID) public /*only who ? everybody ?*/ returns (bool)
	{
		TaskInfo storage taskinfo      = m_taskInfos[_taskID];
		WorkerPool pool                = WorkerPool(taskinfo.workerPoolAffectation);

		// Who ? contributor / client

		require(unlock(taskinfo.requesterAffectation, taskinfo.userCost)); // UNLOCK THE FUNDS FOR REINBURSEMENT

		require(taskRequestHub.setAborted(_taskID));
		require(pool.claimFailedConsensus(_taskID));

		TaskAborted(_taskID, taskinfo.workerPoolAffectation);
		return true;
	}

	function finalizedTask(
		address _taskID,
		string _stdout,
		string _stderr,
		string _uri)
	public returns (bool)
	{
		TaskInfo storage taskinfo = m_taskInfos[_taskID];

		require(msg.sender == taskinfo.workerPoolAffectation);

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

		require(seize(taskinfo.requesterAffectation, taskinfo.userCost)); // SEIZE THE FUNDS FOR PAIEMENT

		require(taskRequestHub.setResult(_taskID, _stdout, _stderr, _uri));
		// incremente app and dataset reputation too  ?
		TaskCompleted(_taskID, taskinfo.workerPoolAffectation);
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
		require(msg.sender == m_taskInfos[_taskID].workerPoolAffectation);
		require(lock(_user, _amount));
		return true;
	}

	function unlockForTask(address _taskID, address _user, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskInfos[_taskID].workerPoolAffectation);
		require(unlock(_user, _amount));
		return true;
	}

	function rewardForConsensus(address _taskID, address _scheduler, uint _amount) public returns (bool) // reward scheduler
	{
		require(msg.sender == m_taskInfos[_taskID].workerPoolAffectation);
		require(reward(_scheduler, _amount));
		return true;
	}

	function rewardForTask(address _taskID, address _worker, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskInfos[_taskID].workerPoolAffectation);
		AccurateContribution(_taskID, _worker);
		// ----------------------- reward(address, uint256) -----------------------
		require(reward(_worker, _amount));
		// ------------------------------------------------------------------------
		m_contributionHistory.success = m_contributionHistory.success.add(1);
		m_scores[_worker] = m_scores[_worker].add(1);
		return true;
	}

	function seizeForTask(address _taskID, address _worker, uint _amount) public returns (bool)
	{
		require(msg.sender == m_taskInfos[_taskID].workerPoolAffectation);
		FaultyContribution(_taskID, _worker);
		// ------------- code of seize(address, uint256) inlined here -------------
		require(seize(_worker, _amount));
		// ------------------------------------------------------------------------
		m_contributionHistory.failled = m_contributionHistory.failled.add(1);
		m_scores[_worker] = m_scores[_worker].sub(m_scores[_worker].min256(50));
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
	function seize(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		Seize(_user, _amount);
		return true;
	}
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
