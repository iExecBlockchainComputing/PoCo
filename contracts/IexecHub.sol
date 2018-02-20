pragma solidity ^0.4.18;

import './AppHub.sol';
import './WorkerPoolHub.sol';
import './WorkerPool.sol';
import './DatasetHub.sol';
import './WorkOrderHub.sol';
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
	struct WorkOrderInfo
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
	WorkOrderHub   workOrderHub;
	WorkerPoolHub  workerPoolHub;

	/**
	 * Internal data
	 */
	mapping(address => Account ) public m_accounts;  // user => stake
	mapping(address => uint256 ) public m_scores;    // user => reputation
	mapping(address => WorkOrderInfo) public m_woInfos; // workorder => metadata
	ContributionHistory          public m_contributionHistory;


	/**
	 * Events
	 */
	event WorkOrder(address woid, address workOrderOwner, address indexed workerPool, address indexed app, address indexed dataset);
	event WorkOrderScheduled(address woid, address indexed workerPool);
	event WorkOrderRevealing(address woid, address indexed workerPool);
	event WorkOrderCancelled(address woid, address indexed workerPool);
	event WorkOrderAborted(address woid, address workerPool);
	event WorkOrderCompleted(address woid, address workerPool);

	event CreateApp(address indexed appOwner,address indexed app,string  appName,uint256 appPrice,string  appParams);
	event CreateDataset(address indexed datasetOwner, address indexed dataset, string  datasetName, uint256 datasetPrice, string  datasetParams);

	event CreateWorkerPool(address indexed workerPoolOwner, address indexed workerPool, string name);
	event OpenWorkerPool(address indexed workerPool);
	event CloseWorkerPool(address indexed workerPool);
	event WorkerPoolUnsubscription(address indexed workerPool, address worker);
	event WorkerPoolEviction(address indexed workerPool, address worker);
	event WorkerPoolSubscription(address indexed workerPool, address worker);

	event FaultyContribution(address woid, address indexed worker);
	event AccurateContribution(address woid, address indexed worker);

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
		address _workOrderHubAddress)
	public
	{
		rlc = RLC(_tokenAddress);

		workerPoolHub  = WorkerPoolHub (_workerPoolHubAddress );
		appHub         = AppHub        (_appHubAddress        );
		datasetHub     = DatasetHub    (_datasetHubAddress    );
		workOrderHub = WorkOrderHub(_workOrderHubAddress);

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

	function createWorkOrder(
		address _workerPool,
		address _app,
		address _dataset,
		string  _workOrderParam,
		uint256 _workReward,
		uint256 _askedTrust,
		bool    _dappCallback,
		address _beneficiary)
	public returns (address createdWorkOrder)
	{
		// msg.sender = requester

		if (_workerPool != address(0)) // address(0) → any workerPool
		{
			require(workerPoolHub.isWorkerPoolRegistred(_workerPool            ));
			require(workerPoolHub.isOpen               (_workerPool            ));
			require(workerPoolHub.isAppAllowed         (_workerPool, _app      ));
			require(workerPoolHub.isDatasetAllowed     (_workerPool, _dataset  ));
			/* require(workerPoolHub.isRequesterAllowed   (_workerPool, msg.sender)); */
			require(appHub.isWorkerPoolAllowed(_app, _workerPool));
		}

		// APP
		require(appHub.isAppRegistred     (_app             ));
		require(appHub.isOpen             (_app             ));
		require(appHub.isDatasetAllowed   (_app, _dataset   ));
		require(appHub.isRequesterAllowed (_app, msg.sender ));


		// Price to pay by the user, initialized with reward
		uint256 userCost = _workReward;
		// add optional appPrice to userCost
		userCost = userCost.add(appHub.getAppPrice(_app)); // dappPrice

		// DATASET
		if (_dataset != address(0)) // address(0) → no dataset
		{
			require(datasetHub.isDatasetRegistred (_dataset             ));
			require(datasetHub.isOpen             (_dataset             ));
			require(datasetHub.isAppAllowed       (_dataset, _app       ));
			require(datasetHub.isRequesterAllowed (_dataset, msg.sender ));
			if (_workerPool != address(0)) // address(0) → any workerPool
			{
				require(datasetHub.isWorkerPoolAllowed(_dataset, _workerPool));
		  }

			// add optional datasetPrice for userCost
			userCost = userCost.add(datasetHub.getDatasetPrice(_dataset));
		}

		// msg.sender wanted here. not tx.origin. we can imagine a smart contract have RLC loaded and user can benefit from it.
		if (m_accounts[msg.sender].stake < userCost)
		{
			require(deposit(userCost.sub(m_accounts[msg.sender].stake))); // Only require the deposit of what is missing
		}

		address newWorkOrder = workOrderHub.createWorkOrder(
			msg.sender, // requester
			_workerPool,
			_app,
			_dataset,
			_workOrderParam,
			_workReward,
			_askedTrust,
			_dappCallback,
			_beneficiary
		);
		WorkOrderInfo storage woInfo = m_woInfos[newWorkOrder];
		woInfo.requesterAffectation  = msg.sender;
		woInfo.appAffectation        = _app;
		woInfo.datasetAffectation    = _dataset;
		woInfo.workerPoolAffectation = _workerPool;
		woInfo.userCost              = userCost;

		require(lock(woInfo.requesterAffectation, woInfo.userCost)); // LOCK THE FUNDS FOR PAYMENT

		// WORKER_POOL
		if (_workerPool != address(0)) // address(0) → any workerPool
		{
			require(WorkerPool(_workerPool).receivedWorkOrder(newWorkOrder, _workReward, _app, _dataset));
		}

		// address newWorkOrder will the woid
		WorkOrder(newWorkOrder, msg.sender, _workerPool, _app, _dataset);
		return newWorkOrder;
	}

	/**
	 * WorkOrder life cycle
	 */

	function acceptMarketWorkOrder(address _woid, address _workerPool, address[] _workers, address _enclaveChallenge) public returns (bool)
 	{
			require(workOrderHub.isWorkOrderRegistred(_woid));
			require(workerPoolHub.getWorkerPoolOwner(msg.sender) == _workerPool);
		  WorkOrderInfo storage woInfo = m_woInfos[_woid];
			require(woInfo.workerPoolAffectation == address(0));
			woInfo.workerPoolAffectation = _workerPool;
			require(getWorkOrderStatus(_woid) == IexecLib.WorkOrderStatusEnum.PENDING);
			require(WorkerPool(woInfo.workerPoolAffectation).acceptMarketWorkOrder(_woid,workOrderHub.getWorkReward(_woid),woInfo.appAffectation,woInfo.datasetAffectation,_workers,_enclaveChallenge));
			require(workOrderHub.setScheduled(_woid));
			// require(lock(msg.sender, VALUE_TO_DETERMINE)); // TODO: scheduler stake
			WorkOrderScheduled(_woid, woInfo.workerPoolAffectation);
			return true;

	}


	function acceptWorkOrder(address _woid) public returns (bool)
	{

		WorkOrderInfo storage woInfo = m_woInfos[_woid];
		require(woInfo.workerPoolAffectation == msg.sender);
		require(getWorkOrderStatus(_woid) == IexecLib.WorkOrderStatusEnum.PENDING);
		require(workOrderHub.setScheduled(_woid));
		// require(lock(msg.sender, VALUE_TO_DETERMINE)); // TODO: scheduler stake
		WorkOrderScheduled(_woid, woInfo.workerPoolAffectation);
		return true;
	}


	function setRevealingStatus(address _woid) public returns (bool)
	{
		WorkOrderInfo storage woInfo = m_woInfos[_woid];
		require(woInfo.workerPoolAffectation == msg.sender);
		require(getWorkOrderStatus(_woid)  == IexecLib.WorkOrderStatusEnum.SCHEDULED);
		require(workOrderHub.setRevealing(_woid));
		WorkOrderRevealing(_woid, woInfo.workerPoolAffectation);
		return true;
	}

	function reopen(address _woid) public returns (bool)
	{
		WorkOrderInfo storage woInfo = m_woInfos[_woid];
		require(woInfo.workerPoolAffectation == msg.sender);
		require(getWorkOrderStatus(_woid)  == IexecLib.WorkOrderStatusEnum.REVEALING);
		require(workOrderHub.setScheduled(_woid));
		WorkOrderScheduled(_woid, woInfo.workerPoolAffectation);
		return true;
	}

	function cancelWorkOrder(address _woid) public returns (bool)
	{
		WorkOrderInfo storage woInfo = m_woInfos[_woid];

		// Why cancelled ? penalty ?
		require(msg.sender == woInfo.requesterAffectation);
		require(unlock(woInfo.requesterAffectation, woInfo.userCost)); // UNLOCK THE FUNDS FOR REINBURSEMENT
		require(getWorkOrderStatus(_woid) == IexecLib.WorkOrderStatusEnum.PENDING);
		require(WorkerPool(woInfo.workerPoolAffectation).cancelWorkOrder(_woid));
		require(workOrderHub.setCancelled(_woid));
		WorkOrderCancelled(_woid, woInfo.workerPoolAffectation);
		return true;
	}

	function claimFailedConsensus(address _woid) public /*only who ? everybody ?*/ returns (bool)
	{
		WorkOrderInfo storage woInfo      = m_woInfos[_woid];
		WorkerPool pool                = WorkerPool(woInfo.workerPoolAffectation);
		IexecLib.WorkOrderStatusEnum currentStatus =getWorkOrderStatus(_woid);
		require(currentStatus == IexecLib.WorkOrderStatusEnum.SCHEDULED || currentStatus == IexecLib.WorkOrderStatusEnum.REVEALING);
		require(pool.claimFailedConsensus(_woid));
		// Who ? contributor / client
		require(unlock(woInfo.requesterAffectation, woInfo.userCost)); // UNLOCK THE FUNDS FOR REINBURSEMENT

		require(workOrderHub.setClaimed(_woid));

		WorkOrderAborted(_woid, woInfo.workerPoolAffectation);
		return true;
	}

	function finalizedWorkOrder(
		address _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool)
	{
		WorkOrderInfo storage woInfo = m_woInfos[_woid];
		require(msg.sender == woInfo.workerPoolAffectation);
		address appForWorkOrder= woInfo.appAffectation;
		uint256 appPrice   = appHub.getAppPrice(appForWorkOrder);
		if (appPrice > 0)
		{
			require(reward(appHub.getAppOwner(appForWorkOrder), appPrice));
				// to unlock a stake ?
		}

		if (woInfo.datasetAffectation != address(0))
		{
			uint256 datasetPrice = datasetHub.getDatasetPrice(woInfo.datasetAffectation);
			if (datasetPrice > 0)
			{
				require(reward(datasetHub.getDatasetOwner(woInfo.datasetAffectation), datasetPrice));
				// to unlock a stake ?
			}
		}

		require(seize(woInfo.requesterAffectation, woInfo.userCost)); // SEIZE THE FUNDS FOR PAIEMENT

		require(workOrderHub.setResult(_woid, _stdout, _stderr, _uri));
		// incremente app and dataset reputation too  ?
		WorkOrderCompleted(_woid, woInfo.workerPoolAffectation);
		return true;
	}

	/**
	 * Views
	 */
	function getWorkerStatus(address _worker) public view returns (address workerPool, uint256 workerScore)
	{
		return (workerPoolHub.getWorkerAffectation(_worker), m_scores[_worker]);
	}

	function getWorkReward(address _woid) public view returns (uint256 workReward)
	{
		return workOrderHub.getWorkReward(_woid);
	}

	function getWorkOrderStatus(address _woid) public view returns (IexecLib.WorkOrderStatusEnum status)
	{
		return workOrderHub.getStatus(_woid);
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
	function subscribeToPool() public returns (bool subscribed)
	{
		//msg.sender = workerPool
		//tx.origin = worker
		require(workerPoolHub.isWorkerPoolRegistred(msg.sender));
		require(m_scores[tx.origin]         >= WorkerPool(msg.sender).m_subscriptionMinimumScorePolicy());
		require(m_accounts[tx.origin].stake >= WorkerPool(msg.sender).m_subscriptionMinimumStakePolicy());
		require(lock(tx.origin, WorkerPool(msg.sender).m_subscriptionLockStakePolicy()));
		require(workerPoolHub.subscribeToPool(msg.sender));
		WorkerPoolSubscription(msg.sender, tx.origin);
		return true;
	}

	function unsubscribeToPool() public returns (bool unsubscribed)
	{
		//msg.sender = workerPool
		//tx.origin = worker
		require(workerPoolHub.isWorkerPoolRegistred(msg.sender));
		require(workerPoolHub.unsubscribeToPool(msg.sender, tx.origin));
		require(unlock(tx.origin, WorkerPool(msg.sender).m_subscriptionLockStakePolicy()));
		WorkerPoolUnsubscription(msg.sender, tx.origin);
		return true;
	}

	function evictWorker(address _worker) public returns (bool unsubscribed)
	{
		require(workerPoolHub.isWorkerPoolRegistred(msg.sender));
		require(workerPoolHub.unsubscribeToPool(msg.sender, _worker));
		require(unlock(_worker, WorkerPool(msg.sender).m_subscriptionLockStakePolicy()));
		WorkerPoolEviction(msg.sender, _worker);
		return true;
	}

	/**
	 * Stake, reward and penalty functions
	 */
	function lockForWork(address _woid, address _user, uint256 _amount) public returns (bool)
	{
		require(msg.sender == m_woInfos[_woid].workerPoolAffectation);
		require(lock(_user, _amount));
		return true;
	}

	function unlockForWork(address _woid, address _user, uint256 _amount) public returns (bool)
	{
		require(msg.sender == m_woInfos[_woid].workerPoolAffectation);
		require(unlock(_user, _amount));
		return true;
	}

	function rewardForConsensus(address _woid, address _scheduler, uint256 _amount) public returns (bool) // reward scheduler
	{
		require(msg.sender == m_woInfos[_woid].workerPoolAffectation);
		require(reward(_scheduler, _amount));
		return true;
	}

	function rewardForWork(address _woid, address _worker, uint256 _amount) public returns (bool)
	{
		require(msg.sender == m_woInfos[_woid].workerPoolAffectation);
		AccurateContribution(_woid, _worker);
		// ----------------------- reward(address, uint256) -----------------------
		require(reward(_worker, _amount));
		// ------------------------------------------------------------------------
		m_contributionHistory.success = m_contributionHistory.success.add(1);
		m_scores[_worker] = m_scores[_worker].add(1);
		return true;
	}

	function seizeForWork(address _woid, address _worker, uint256 _amount) public returns (bool)
	{
		require(msg.sender == m_woInfos[_woid].workerPoolAffectation);
		FaultyContribution(_woid, _worker);
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
	function checkBalance(address _owner) public view returns (uint256 stake, uint256 locked)
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
	function lock(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = m_accounts[_user].stake.sub(_amount);
		m_accounts[_user].locked = m_accounts[_user].locked.add(_amount);
		return true;
	}

	function unlock(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		m_accounts[_user].stake  = m_accounts[_user].stake.add(_amount);
		return true;
	}

}
