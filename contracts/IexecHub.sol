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
	// uint private constant WORKERPOOL_CREATION_STAKE = 5000; // updated by vote or super admin ?
	// uint private constant APP_CREATION_STAKE        = 5000; // updated by vote or super admin ?
	// uint private constant DATASET_CREATION_STAKE    = 5000; // updated by vote or super admin ?
	// uint private constant WORKER_MEMBERSHIP_STAKE   = 5000; // updated by vote or super admin ?

	/**
	* RLC contract for token transfers.
	*/
	RLC public rlc;

	/**
	 * Slaves contracts
	 */
	AppHub        public appHub;
	DatasetHub    public datasetHub;
	WorkerPoolHub public workerPoolHub;

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
	 * Categories
	 */
	mapping(uint256 => IexecLib.Category) public m_categories;
	uint256                               public m_categoriesCount;
	address                               public m_categoriesCreator;
	modifier onlyCategoriesCreator()
	{
		require(msg.sender == m_categoriesCreator);
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
	event CreateWorkerPool(address indexed workerPoolOwner, address indexed workerPool, string workerPoolDescription                                        );

	event CreateCategory  (uint256 catid, string name, string description, uint256 workClockTimeRef);

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
		marketplaceAddress  = address(0);
		m_categoriesCreator = address(0);

		m_contributionHistory.success = 0;
		m_contributionHistory.failled = 0;

	}

	function attachMarketplace(address _marketplaceAddress) public
	{
		require(marketplaceAddress == address(0));
		marketplaceAddress = _marketplaceAddress; //new Marketplace(this);
		marketplace        =  Marketplace(_marketplaceAddress);
	}

	function setCategoriesCreator(address _categoriesCreator) public
	{
		require(m_categoriesCreator == address(0) || (m_categoriesCreator != address(0) && msg.sender == m_categoriesCreator));
		m_categoriesCreator = _categoriesCreator;
	}

	/**
	 * Factory
	 */

	function createCategory(
		string  _name,
		string  _description,
		uint256 _workClockTimeRef)
	public onlyCategoriesCreator returns (uint256 catid)
	{
		m_categoriesCount                  = m_categoriesCount.add(1);
		IexecLib.Category storage category = m_categories[m_categoriesCount];
		category.catid                     = m_categoriesCount;
		category.name                      = _name;
		category.description               = _description;
		category.workClockTimeRef          = _workClockTimeRef;
		CreateCategory(m_categoriesCount, _name, _description, _workClockTimeRef);
		return m_categoriesCount;
	}

	function createWorkerPool(
		string  _description,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy)
	external returns (address createdWorkerPool)
	{
		// add a staking and lock for the msg.sender scheduler. in order to prevent against pool creation spam ?
		// require(lock(msg.sender, WORKERPOOL_CREATION_STAKE)); ?
		address newWorkerPool = workerPoolHub.createWorkerPool(
			_description,
			_subscriptionLockStakePolicy,
			_subscriptionMinimumStakePolicy,
			_subscriptionMinimumScorePolicy,
			marketplaceAddress
		);
		CreateWorkerPool(tx.origin, newWorkerPool, _description);
		return newWorkerPool;
	}

	function createApp(
		string  _appName,
		uint256 _appPrice,
		string  _appParams)
	external returns (address createdApp)
	{
		// require(lock(msg.sender, APP_CREATION_STAKE)); ?
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
	external returns (address createdDataset)
	{
		// require(lock(msg.sender, DATASET_CREATION_STAKE)); ?
		address newDataset = datasetHub.createDataset(
			_datasetName,
			_datasetPrice,
			_datasetParams
			);
		CreateDataset(tx.origin, newDataset, _datasetName, _datasetPrice, _datasetParams);
		return newDataset;
	}

	/**
	 * WorkOrder Emission
	 */
	function answerEmitWorkOrder(
		uint256 _marketorderIdx,
		address _workerpool,
		address _app,
		address _dataset,
		string  _params,
		address _callback,
		address _beneficiary)
	external returns (address)
	{
		address requester = msg.sender;
		require(marketplace.answerConsume(_marketorderIdx, requester, _workerpool));

		WorkOrder workorder = WorkOrder(emitWorkOrder(
			_marketorderIdx,
			requester,
			_workerpool,
			_app,
			_dataset,
			_params,
			_callback,
			_beneficiary
		));

		workorder.activate(); // revert on error
		WorkOrderActivated(workorder, _workerpool);

		return workorder;
	}

	function emitWorkOrder(
		uint256 _marketorderIdx,
		address _requester,
		address _workerpool, // Address of a smartcontract
		address _app,        // Address of a smartcontract
		address _dataset,    // Address of a smartcontract
		string  _params,
		address _callback,
		address _beneficiary)
	internal returns (address)
	{
		uint256 emitcost = lockWorkOrderCost(_requester, _workerpool, _app, _dataset);

		WorkOrder workorder = new WorkOrder(
			_marketorderIdx,
			_requester,
			_app,
			_dataset,
			_workerpool,
			emitcost,
			_params,
			_callback,
			_beneficiary
		);

		require(WorkerPool(_workerpool).emitWorkOrder(workorder, _marketorderIdx));

		return workorder;
	}

	function lockWorkOrderCost(
		address _requester,
		address _workerpool, // Address of a smartcontract
		address _app,        // Address of a smartcontract
		address _dataset)    // Address of a smartcontract
	internal returns (uint256)
	{
		// APP
		App app = App(_app);
		require(appHub.isAppRegistered (_app       ));
		// initialize usercost with dapp price
		uint256 emitcost = app.m_appPrice();

		// DATASET
		if (_dataset != address(0)) // address(0) → no dataset
		{
			Dataset dataset = Dataset(_dataset);
			require(datasetHub.isDatasetRegistred(_dataset   ));
			// add optional datasetPrice for userCost
			emitcost = emitcost.add(dataset.m_datasetPrice());
		}

		// WORKERPOOL
		WorkerPool workerpool = WorkerPool(_workerpool);
		require(workerPoolHub.isWorkerPoolRegistered(_workerpool));

		require(lock(_requester, emitcost)); // Lock funds for app + dataset payment

		return emitcost;
	}

	/**
	 * WorkOrder life cycle
	 */
	function startRevealingPhase(address _woid) public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);
		require(workorder.m_workerpool() == msg.sender);
		workorder.reveal(); // revert on error
		WorkOrderRevealing(_woid, msg.sender); // msg.sender is workorder.m_workerpool()
		return true;
	}

	function reActivate(address _woid) public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);
		require(workorder.m_workerpool() == msg.sender);
		workorder.reactivate();  // revert on error
		WorkOrderActivated(_woid, workorder.m_workerpool());
		return true;
	}

	// TODO: msg.sender = requester or _beneficiary
	function claimFailedConsensus(address _woid) public returns (bool)
	{
		WorkOrder  workorder  = WorkOrder(_woid);
		WorkerPool workerpool = WorkerPool(workorder.m_workerpool());

		IexecLib.WorkOrderStatusEnum currentStatus = workorder.m_status();
		require(currentStatus == IexecLib.WorkOrderStatusEnum.ACTIVE || currentStatus == IexecLib.WorkOrderStatusEnum.REVEALING);//to remove
		// Unlock stakes for all workers
		require(workerpool.claimFailedConsensus(_woid));
		workorder.claim(); // revert on error

		uint    value;
		address workerpoolOwner;
		(,,value,,,,workerpoolOwner) = marketplace.getMarketOrder(workorder.m_marketorderIdx());

		require(unlock(workorder.m_requester(), value.add(workorder.m_emitcost()))); // UNLOCK THE FUNDS FOR REINBURSEMENT
		require(seize (workerpoolOwner,         value                            ));
		// IMPORTANT TODO: who do we give the extra value comming from the sheduler ?

		WorkOrderAborted(_woid, workorder.m_workerpool());
		return true;
	}

	function finalizeWorkOrder(
		address _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);

		require(workorder.m_workerpool() == msg.sender);
		require(workorder.m_status()     == IexecLib.WorkOrderStatusEnum.REVEALING);

		// APP
		App     app      = App(workorder.m_app());
		uint256 appPrice = app.m_appPrice();
		if (appPrice > 0)
		{
			require(reward(app.m_owner(), appPrice));
			// TODO: to unlock a stake ?
		}
		// incremente app reputation?

		// DATASET
		Dataset dataset = Dataset(workorder.m_dataset());
		if (dataset != address(0))
		{
			uint256 datasetPrice = dataset.m_datasetPrice();
			if (datasetPrice > 0)
			{
				require(reward(dataset.m_owner(), datasetPrice));
				// TODO: to unlock a stake ?
			}
			// incremente dataset reputation?
		}

		// WORKERPOOL → rewarding done by the caller itself

		/**
		 * seize stacked funds from requester.
		 * reward = value: was locked at market making
		 * emitcost: was locked at when emiting the workorder
		 */
		uint256 value;
 		address workerpoolOwner;
 		(,,value,,,,workerpoolOwner) = marketplace.getMarketOrder(workorder.m_marketorderIdx());

		require(seize (workorder.m_requester(), value.add(workorder.m_emitcost()))); // seize funds for payment (market value + emitcost)
		require(unlock(workerpoolOwner,         value));                             // unlock scheduler stake

		// write results
		workorder.setResult(_stdout, _stderr, _uri); // revert on error

		WorkOrderCompleted(_woid, workorder.m_workerpool());
		return true;
	}

	/**
	 * Views
	 */
	function getCategoryWorkClockTimeRef(uint256 _catId) public view returns (uint256 workClockTimeRef)
	{
		require(existingCategory(_catId));
		return m_categories[_catId].workClockTimeRef;
	}

	function existingCategory(uint256 _catId) public view  returns (bool categoryExist){
		return m_categories[_catId].catid > 0;
	}

	function getCategory(uint256 _catId) public view returns (uint256 catid, string name, string  description, uint256 workClockTimeRef)
	{
		require(existingCategory(_catId));
		return (
		m_categories[_catId].catid,
		m_categories[_catId].name,
		m_categories[_catId].description,
		m_categories[_catId].workClockTimeRef
		);
	}

	function getWorkerStatus(address _worker) public view returns (address workerPool, uint256 workerScore)
	{
		return (workerPoolHub.getWorkerAffectation(_worker), m_scores[_worker]);
	}

	/**
	 * Worker subscription
	 */
	function registerToPool(address _worker) public returns (bool subscribed)
	// msg.sender = workerPool
	{
		WorkerPool workerpool = WorkerPool(msg.sender);
		// Check credentials
		require(workerPoolHub.isWorkerPoolRegistered(msg.sender));
		// Lock worker deposit
		require(lock(_worker, workerpool.m_subscriptionLockStakePolicy()));
		// Check subscription policy
		require(m_accounts[_worker].stake >= workerpool.m_subscriptionMinimumStakePolicy());
		require(m_scores[_worker]         >= workerpool.m_subscriptionMinimumScorePolicy());
		// Update affectation
		require(workerPoolHub.registerWorkerAffectation(msg.sender, _worker));
		// Trigger event notice
		WorkerPoolSubscription(msg.sender, _worker);
		return true;
	}

	function unregisterFromPool(address _worker) public returns (bool unsubscribed)
	// msg.sender = workerPool && tx.origin = worker
	{
		WorkerPool workerpool = WorkerPool(msg.sender);
		// Check credentials
		require(workerPoolHub.isWorkerPoolRegistered(msg.sender));
		// Unlock worker stake
		require(unlock(_worker, workerpool.m_subscriptionLockStakePolicy()));
		// Update affectation
		require(workerPoolHub.unregisterWorkerAffectation(msg.sender, _worker));
		// Trigger event notice
		WorkerPoolUnsubscription(msg.sender, _worker);
		return true;
	}

	function evictWorker(address _worker) public returns (bool unsubscribed)
	// msg.sender = workerpool && _worker = worker
	{
		WorkerPool workerpool = WorkerPool(msg.sender);
		// Check credentials
		require(workerPoolHub.isWorkerPoolRegistered(msg.sender));
		require(workerPoolHub.getWorkerAffectation(_worker) == msg.sender);
		// Unlick worker stake
		require(unlock(_worker, workerpool.m_subscriptionLockStakePolicy()));
		// Update affectation
		require(workerPoolHub.unregisterWorkerAffectation(msg.sender, _worker));
		// Trigger event notice
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
	function unlockForOrder(address _user, uint256 _amount) public  onlyMarketplace returns (bool)
	{
		require(unlock(_user, _amount));
		return true;
	}
	function seizeForOrder(address _user, uint256 _amount) public onlyMarketplace returns (bool)
	{
		require(seize(_user,_amount));
		return true;
	}
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
	function unlockForWork(address _woid, address _user, uint256 _amount) public returns (bool)
	{
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(unlock(_user, _amount));
		return true;
	}
	function rewardForWork(address _woid, address _worker, uint256 _amount, bool _reputation) public returns (bool)
	{
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(reward(_worker, _amount));
		// ------------------------------------------------------------------------
		if (_reputation)
		{
			AccurateContribution(_woid, _worker);
			m_contributionHistory.success = m_contributionHistory.success.add(1);
			m_scores[_worker] = m_scores[_worker].add(1);
		}
		return true;
	}
	function seizeForWork(address _woid, address _worker, uint256 _amount, bool _reputation) public returns (bool)
	{
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(seize(_worker, _amount));
		// ------------------------------------------------------------------------
		if (_reputation)
		{
			FaultyContribution(_woid, _worker);
			m_contributionHistory.failled = m_contributionHistory.failled.add(1);
			m_scores[_worker] = m_scores[_worker].sub(m_scores[_worker].min(50));
		}
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
}
