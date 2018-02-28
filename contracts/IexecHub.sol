pragma solidity ^0.4.18;

import "rlc-token/contracts/RLC.sol";

import './WorkOrder.sol';
import './Marketplace.sol';
import './AppHub.sol';
import './DatasetHub.sol';
import './WorkerPoolHub.sol';
import "./SafeMathOZ.sol";
import './IexecLib.sol';


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
	* RLC contract for token transfers.
	*/
	RLC public rlc;

	/**
	 * Slaves contracts
	 */
	AppHub        appHub;
	DatasetHub    datasetHub;
	WorkerPoolHub workerPoolHub;

	/**
	 * Market place
	 */
	Marketplace marketplace;
	address     public marketplaceAddress;
	modifier onlyMarketplace()
	{
		require(msg.sender == marketplaceAddress);
		_;
	}

	/**
	 * Escrow
	 */
	mapping(address => IexecLib.Account) public m_accounts;

	/**
	 * Reputation for PoCo
	 */
	mapping(address => uint256)  public m_scores;
	IexecLib.ContributionHistory public m_contributionHistory;


	/* event WorkOrderEmit */
	event WorkOrderActivated(address woid, address indexed workerPool);
	event WorkOrderRevealing(address woid, address indexed workerPool);
	event WorkOrderCancelled(address woid, address indexed workerPool);
	event WorkOrderAborted  (address woid, address workerPool);
	event WorkOrderCompleted(address woid, address workerPool);

	event CreateApp       (address indexed appOwner,        address indexed app,        string appName,     uint256 appPrice,     string appParams    );
	event CreateDataset   (address indexed datasetOwner,    address indexed dataset,    string datasetName, uint256 datasetPrice, string datasetParams);
	event CreateWorkerPool(address indexed workerPoolOwner, address indexed workerPool, string workerPoolName                                         );

	event OpenWorkerPool          (address indexed workerPool);
	event CloseWorkerPool         (address indexed workerPool);
	event WorkerPoolSubscription  (address indexed workerPool, address worker);
	event WorkerPoolUnsubscription(address indexed workerPool, address worker);
	event WorkerPoolEviction      (address indexed workerPool, address worker);

	event AccurateContribution(address woid, address indexed worker);
	event FaultyContribution  (address woid, address indexed worker);

	event Deposit (address owner, uint256 amount);
	event Withdraw(address owner, uint256 amount);
	event Reward  (address user,  uint256 amount);
	event Seize   (address user,  uint256 amount);

	/**
	 * Constructor
	 */
	function IexecHub(
		address _tokenAddress,
		address _workerPoolHubAddress,
		address _appHubAddress,
		address _datasetHubAddress
	)
	public
	{
		rlc = RLC(_tokenAddress);

		workerPoolHub      = WorkerPoolHub(_workerPoolHubAddress);
		appHub             = AppHub       (_appHubAddress       );
		datasetHub         = DatasetHub   (_datasetHubAddress   );
		// marketplace        = Marketplace(marketplaceAddress); //too much gas
		// marketplaceAddress = new Marketplace(this); //too much gas
		marketplaceAddress = address(0);

		m_contributionHistory.success = 0;
		m_contributionHistory.failled = 0;
	}

	function attachMarketplace(address _marketplaceAddress)
	{
		require(marketplaceAddress == address(0));
		marketplaceAddress = _marketplaceAddress;//new Marketplace(this);
		marketplace        =  Marketplace(_marketplaceAddress);
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
			_subscriptionMinimumScorePolicy,
			marketplaceAddress
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

	/**
	 * WorkOrder life cycle
	 */
	function answerEmitWorkOrder(
		uint256 _marketorderIdx,
		address _workerpool,
		address _app,
		address _dataset,
		string  _params,
		address _callback,
		address _beneficiary)
	public returns (address)
	{
		require(marketplace.answerConsume(_marketorderIdx, msg.sender, _workerpool));
		return emitWorkOrder(
			_marketorderIdx,
			msg.sender,
			_workerpool,
			_app,
			_dataset,
			_params,
			_callback,
			_beneficiary
		);
	}
	function consumeEmitWorkOrder(
		uint256 _marketorderIdx,
		address _workerpool,
		address _app,
		address _dataset,
		string  _params,
		address _callback,
		address _beneficiary)
	public returns (address)
	{
		require(marketplace.useConsume(_marketorderIdx, msg.sender, _workerpool));
		return emitWorkOrder(
			_marketorderIdx,
			msg.sender,
			_workerpool,
			_app,
			_dataset,
			_params,
			_callback,
			_beneficiary
		);
	}

	function emitWorkOrder(
		uint256 _marketorderIdx,
		address _requester,
		address _workerpool,
		address _app,
		address _dataset,
		string  _params,
		address _callback,
		address _beneficiary)
	internal returns (address)
	{
		// APP
		require(appHub.isAppRegistred     (_app             ));
		require(appHub.isOpen             (_app             ));
		require(appHub.isDatasetAllowed   (_app, _dataset   ));
		require(appHub.isRequesterAllowed (_app, _requester ));
		require(appHub.isWorkerPoolAllowed(_app, _workerpool));
		// Price to pay by the user, initialized with reward + dapp Price
		uint256 emitcost = appHub.getAppPrice(_app);
		// DATASET
		if (_dataset != address(0)) // address(0) → no dataset
		{
			require(datasetHub.isDatasetRegistred (_dataset             ));
			require(datasetHub.isOpen             (_dataset             ));
			require(datasetHub.isAppAllowed       (_dataset, _app       ));
			require(datasetHub.isRequesterAllowed (_dataset, _requester ));
			require(datasetHub.isWorkerPoolAllowed(_dataset, _workerpool));
			// add optional datasetPrice for userCost
			emitcost = emitcost.add(datasetHub.getDatasetPrice(_dataset));
		}
		// WORKERPOOL
		require(workerPoolHub.isWorkerPoolRegistred(_workerpool            ));
		require(workerPoolHub.isOpen               (_workerpool            ));
		require(workerPoolHub.isAppAllowed         (_workerpool, _app      ));
		require(workerPoolHub.isDatasetAllowed     (_workerpool, _dataset  ));
		// require(workerPoolHub.isRequesterAllowed   (_workerpool, msg.sender));

		// msg.sender wanted here. not tx.origin. we can imagine a smart contract have RLC loaded and user can benefit from it.
		require(lockDeposit(_requester, emitcost)); // Lock funds for app + dataset payment

		WorkOrder workorder = new WorkOrder(
			this,
			_marketorderIdx,
			_requester,
			_app,
			_dataset,
			_workerpool,
			// marketplace.getMarketOrderValue(_marketorderIdx), Stack too deep, try removing local variables
			emitcost,
			// marketplace.getMarketOrderTrust(_marketorderIdx), Stack too deep, try removing local variables
			_params,
			_callback,
			_beneficiary
		);
		workorder.setActive(); // TODO: done by the scheduler within X days?
		// REPLACE ?
		/* workOrderHub.addWorkOrder(_requester, workorder); // TODO: move to WorkOrderHub → IexecHub */
		require(WorkerPool(_workerpool).emitWorkOrder(workorder, _marketorderIdx));

		WorkOrderActivated(workorder, _workerpool);
		return workorder;
	}

	function startRevealingPhase(address _woid) public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);
		require(workorder.m_workerpool() == msg.sender);
		require(workorder.m_status()     == IexecLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.setRevealing());
		WorkOrderRevealing(_woid, msg.sender); // msg.sender is workorder.m_workerpool()
		return true;
	}

	function reActivate(address _woid) public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);
		require(workorder.m_workerpool() == msg.sender);
		require(workorder.m_status()     == IexecLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.setActive());
		WorkOrderActivated(_woid, workorder.m_workerpool());
		return true;
	}

	// TODO: who ? everybody ?
	function claimFailedConsensus(address _woid) public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);

		IexecLib.WorkOrderStatusEnum currentStatus = workorder.m_status();
		require(currentStatus == IexecLib.WorkOrderStatusEnum.ACTIVE || currentStatus == IexecLib.WorkOrderStatusEnum.REVEALING);
		require(WorkerPool(workorder.m_workerpool()).claimFailedConsensus(_woid));
		// Who ? contributor / client
		require(workorder.setClaimed());

		uint claim = marketplace.getMarketOrderValue(workorder.m_marketorderIdx()).add(workorder.m_emitcost());
		require(unlock(workorder.m_requester(), claim)); // UNLOCK THE FUNDS FOR REINBURSEMENT

		WorkOrderAborted(_woid, workorder.m_workerpool());
		return true;
	}

	function finalizedWorkOrder(
		address _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);
		require(workorder.m_workerpool() == msg.sender);
		require(workorder.m_status()     == IexecLib.WorkOrderStatusEnum.REVEALING);

		// reward app
		address app      = workorder.m_app();
		uint256 appPrice = appHub.getAppPrice(app);
		if (appPrice > 0)
		{
			require(reward(appHub.getAppOwner(app), appPrice));
			// TODO: to unlock a stake ?
		}
		// incremente app reputation?
		// reward dataset
		address dataset = workorder.m_dataset();
		if (dataset != address(0))
		{
			uint256 datasetPrice = datasetHub.getDatasetPrice(dataset);
			if (datasetPrice > 0)
			{
				require(reward(datasetHub.getDatasetOwner(dataset), datasetPrice));
				// TODO: to unlock a stake ?
			}
			// incremente dataset reputation?
		}

		// TODO: reward the workerpool → done by the callser itself

		/**
		 * seize stacked funds from requester.
		 * reward = value: was locked at market making
		 * emitcost: was locked at when emiting the workorder
		 */
		uint claim = marketplace.getMarketOrderValue(workorder.m_marketorderIdx()).add(workorder.m_emitcost());
		require(seize(workorder.m_requester(), claim)); // seize funds for payment

		// write results
		require(workorder.setResult(_stdout, _stderr, _uri));

		WorkOrderCompleted(_woid, workorder.m_workerpool());
		return true;
	}

	/**
	 * Views
	 */
	function getWorkerStatus(address _worker) public view returns (address workerPool, uint256 workerScore)
	{
		return (workerPoolHub.getWorkerAffectation(_worker), m_scores[_worker]);
	}
	/**
	 * WorkerPool management
	 */
	function openCloseWorkerPool(address _workerPool, bool open) public returns (bool)
	{
		WorkerPool pool = WorkerPool(_workerPool);
		require(pool.getWorkerPoolOwner() == msg.sender);
		if (open)
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
		// msg.sender = workerPool
		// tx.origin = worker
		require(workerPoolHub.isWorkerPoolRegistred(msg.sender));
		require(lock(tx.origin, WorkerPool(msg.sender).m_subscriptionLockStakePolicy()));
		require(m_accounts[tx.origin].stake >= WorkerPool(msg.sender).m_subscriptionMinimumStakePolicy());
		require(m_scores[tx.origin]         >= WorkerPool(msg.sender).m_subscriptionMinimumScorePolicy());
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
	/* Marketplace */
	function lockForOrder(address _user, uint256 _amount) public onlyMarketplace returns (bool)
	{
		require(lock(_user, _amount));
		return true;
	}
	/* Marketplace */
	function lockDepositForOrder(address _user, uint256 _amount) public onlyMarketplace returns (bool)
	{
		require(lockDeposit(_user, _amount));
		return true;
	}
	/* Marketplace */
	function unlockForOrder(address _user, uint256 _amount) public  onlyMarketplace returns (bool)
	{
		require(unlock(_user, _amount));
		return true;
	}
	/* Marketplace */
	function seizeForOrder(address _user, uint256 _amount) public onlyMarketplace returns (bool)
	{
		require(seize(_user,_amount));
		return true;
	}
	/* Marketplace */
	function rewardForOrder(address _user, uint256 _amount) public onlyMarketplace returns (bool)
	{
		require(reward(_user,_amount));
		return true;
	}
	/* Work */
	function lockForWork(address _woid, address _user, uint256 _amount) public returns (bool)
	{
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(lock(_user, _amount));
		return true;
	}
	/* Work */
	function unlockForWork(address _woid, address _user, uint256 _amount) public returns (bool)
	{
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(unlock(_user, _amount));
		return true;
	}
	/* Work */
	function rewardForWork(address _woid, address _worker, uint256 _amount) public returns (bool)
	{
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		AccurateContribution(_woid, _worker);
		// ----------------------- reward(address, uint256) -----------------------
		require(reward(_worker, _amount));
		// ------------------------------------------------------------------------
		m_contributionHistory.success = m_contributionHistory.success.add(1);
		m_scores[_worker] = m_scores[_worker].add(1);
		return true;
	}
	/* Work */
	function seizeForWork(address _woid, address _worker, uint256 _amount) public returns (bool)
	{
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		FaultyContribution(_woid, _worker);
		// ------------- code of seize(address, uint256) inlined here -------------
		require(seize(_worker, _amount));
		// ------------------------------------------------------------------------
		m_contributionHistory.failled = m_contributionHistory.failled.add(1);
		m_scores[_worker] = m_scores[_worker].sub(m_scores[_worker].min256(50));
		return true;
	}
	/* Consensus */
	function rewardForConsensus(address _woid, address _scheduler, uint256 _amount) public returns (bool) // reward scheduler
	{
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(reward(_scheduler, _amount));
		return true;
	}

	/**
	 * Wallet methods: public
	 */
	function deposit(uint256 _amount) external returns (bool)
	{
		require(rlc.transferFrom(msg.sender, address(this), _amount));
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.add(_amount);
		Deposit(msg.sender, _amount);
		return true;
	}
	function withdraw(uint256 _amount) external returns (bool)
	{
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.sub(_amount);
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
	function lockDeposit(address _user, uint256 _amount) internal returns (bool)
	{
		if (m_accounts[_user].stake < _amount)
		{
			uint256 delta = _amount.sub(m_accounts[_user].stake);
			require(rlc.transferFrom(_user, address(this), delta));
			m_accounts[_user].stake = m_accounts[_user].stake.add(delta);
			Deposit(_user, delta);
		}
		require(lock(_user, _amount));
		return true;
	}

}
