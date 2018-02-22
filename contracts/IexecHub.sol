pragma solidity ^0.4.18;

import "rlc-token/contracts/RLC.sol";

import './WorkOrder.sol';

import './AppHub.sol';
import './DatasetHub.sol';
import './WorkerPoolHub.sol';
import './WorkOrderHub.sol';
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
	AppHub         appHub;
	DatasetHub     datasetHub;
	WorkOrderHub   workOrderHub;
	WorkerPoolHub  workerPoolHub;

	/**
	 * Escrow
	 */
	mapping(address => IexecLib.Account) public m_accounts;

	/**
	 * Reputation for PoCo
	 */
	mapping(address => uint256)  public m_scores;
	IexecLib.ContributionHistory public m_contributionHistory;

	/**
	 * Marketplace
	 */
	// Array of positions
	IexecLib.MarketOrder[]                                        public m_orderBook;
	// marketorderIdx => user => workerpool => quantity
	mapping(uint => mapping(address => mapping(address => uint))) public m_assetBook;

	/**
	 * Events
	 */
	/* event PositionBid */
	/* event PositionBidClosed */
	/* event PositionBidMarketed */
	// event PositionAsk
	// event PositionAskClosed (Accepted)
	// event PositionAskMarketed (Accepted)
	// event WorkOrderSubmit
	// event WorkOrderRevealing
	// event WorkOrderAborted
	// event WorkOrderCompleted

	/* event WorkOrder         (address woid, address workOrderOwner, address indexed workerPool, address indexed app, address indexed dataset); */
	event WorkOrderActivate (address woid, address indexed workerPool);
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
		address _datasetHubAddress,
		address _workOrderHubAddress)
	public
	{
		rlc = RLC(_tokenAddress);

		workerPoolHub = WorkerPoolHub(_workerPoolHubAddress );
		appHub        = AppHub       (_appHubAddress        );
		datasetHub    = DatasetHub   (_datasetHubAddress    );
		workOrderHub  = WorkOrderHub (_workOrderHubAddress);

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

	/**
	 * Marketplace
	 */
	function emitMarketOrder(
		IexecLib.MarketOrderDirectionEnum _direction,
		uint256 _category,
		uint256 _trust,
		uint256 _value,
		address _workerpool,
		uint256 _volume)
	public returns (uint)
	{
		uint256                      marketorderIdx = m_orderBook.length;
		IexecLib.MarketOrder storage marketorder    = m_orderBook[marketorderIdx];

		marketorder.direction = _direction;
		marketorder.category  = _category;
		marketorder.trust     = _trust;
		marketorder.value     = _value;
		marketorder.volume    = _volume;
		marketorder.remaining = _volume;

		if (_direction == IexecLib.MarketOrderDirectionEnum.BID)
		{
			require(lock(msg.sender, _value.mul(_volume)));
			marketorder.requester  = msg.sender;
			marketorder.workerpool = _workerpool;
		}
		else if (_direction == IexecLib.MarketOrderDirectionEnum.ASK)
		{
			require(workerPoolHub.getWorkerPoolOwner(_workerpool) == msg.sender);
			marketorder.requester  = address(0);
			marketorder.workerpool = _workerpool;
		}
		else
		{
			revert();
		}
		// MarketOrderEmitted(); // TODO create event
		return marketorderIdx;
	}
	function closeMarketOrder(uint256 _marketorderIdx) public returns (bool)
	{
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];

		if (marketorder.direction == IexecLib.MarketOrderDirectionEnum.BID)
		{
			require(marketorder.requester == msg.sender);
			require(unlock(msg.sender, marketorder.value.mul(marketorder.remaining)));
		}
		else if (marketorder.direction == IexecLib.MarketOrderDirectionEnum.ASK)
		{
			require(workerPoolHub.getWorkerPoolOwner(marketorder.workerpool) == msg.sender);
		}
		else
		{
			revert();
		}

		marketorder.direction = IexecLib.MarketOrderDirectionEnum.CLOSED;
		// MarketOrderClosed(); // TODO create event
		return true;
	}

	function answerBidOrder(uint256 _marketorderIdx, uint256 _quantity, address _workerpool) public returns (uint256)
	{
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];

		require(marketorder.direction == IexecLib.MarketOrderDirectionEnum.BID);

		require(workerPoolHub.getWorkerPoolOwner(_workerpool) == msg.sender);
		require(marketorder.workerpool == address(0) || marketorder.workerpool == marketorder.workerpool);

		_quantity.min256(marketorder.remaining);
		marketorder.remaining = marketorder.remaining.sub(_quantity);
		if (marketorder.remaining == 0)
		{
			marketorder.direction == IexecLib.MarketOrderDirectionEnum.CLOSED;
		}
		// marketorderIdx => user => workerpool => quantity
		m_assetBook[_marketorderIdx][marketorder.requester][_workerpool] = m_assetBook[_marketorderIdx][marketorder.requester][_workerpool].add(_quantity);

		// TODO: create event
		return _quantity;
	}

	function answerAskOrder(uint _marketorderIdx, uint256 _quantity) public returns (uint256)
	{
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];

		require(marketorder.direction == IexecLib.MarketOrderDirectionEnum.ASK);

		_quantity.min256(marketorder.remaining);
		marketorder.remaining = marketorder.remaining.sub(_quantity);
		if (marketorder.remaining == 0)
		{
			marketorder.direction == IexecLib.MarketOrderDirectionEnum.CLOSED;
		}
		require(lock(msg.sender, marketorder.value.mul(_quantity)));

		m_assetBook[_marketorderIdx][msg.sender][marketorder.workerpool] = m_assetBook[_marketorderIdx][msg.sender][marketorder.workerpool].add(_quantity);

		// TODO: create event
		return _quantity;
	}

	/**
	 * WorkOrder life cycle
	 */
	function emitWorkOrder(
		uint256 _marketorderIdx,
		address _workerpool,
		address _app,
		address _dataset,
		string  _params,
		bool    _callback,
		address _beneficiary)
	public returns (address)
	{
		// msg.sender = requester

		require(m_assetBook[_marketorderIdx][msg.sender][_workerpool] > 0);
		m_assetBook[_marketorderIdx][msg.sender][_workerpool] = m_assetBook[_marketorderIdx][msg.sender][_workerpool].sub(1);

		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];

		// APP
		require(appHub.isAppRegistred     (_app             ));
		require(appHub.isOpen             (_app             ));
		require(appHub.isDatasetAllowed   (_app, _dataset   ));
		require(appHub.isRequesterAllowed (_app, msg.sender ));
		require(appHub.isWorkerPoolAllowed(_app, _workerpool));
		// Price to pay by the user, initialized with reward + dapp Price
		uint256 emitcost = appHub.getAppPrice(_app);
		// DATASET
		if (_dataset != address(0)) // address(0) → no dataset
		{
			require(datasetHub.isDatasetRegistred (_dataset             ));
			require(datasetHub.isOpen             (_dataset             ));
			require(datasetHub.isAppAllowed       (_dataset, _app       ));
			require(datasetHub.isRequesterAllowed (_dataset, msg.sender ));
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
		if (m_accounts[msg.sender].stake < emitcost)
		{
			require(deposit(emitcost.sub(m_accounts[msg.sender].stake))); // Only require the deposit of what is missing
		}
		require(lock(msg.sender, emitcost)); // Lock funds for app + dataset payment

		WorkOrder woid = new WorkOrder(
			this,
			_marketorderIdx,
			msg.sender,
			_app,
			_dataset,
			_workerpool,
			marketorder.value,
			emitcost,
			marketorder.trust,
			_params,
			_callback,
			_beneficiary
		);
		//WorkOrderHub.addWorkOrder(msg.sender, woid); // TODO: move to WorkOrderHub → IexecHub

		WorkOrderActivate(woid, _workerpool);
		return woid;
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
		WorkOrderActivate(_woid, workorder.m_workerpool());
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

		uint claim = workorder.m_reward().add(workorder.m_emitcost());
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

		// TODO: reward the workerpool

		/**
		 * seize stacked funds from requester.
		 * reward = value: was locked at market making
		 * emitcost: was locked at when emiting the workorder
		 */
		uint claim = workorder.m_reward().add(workorder.m_emitcost());
		require(seize(workorder.m_requester(), claim)); // UNLOCK THE FUNDS FOR REINBURSEMENT

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
	/*
	function getWorkOrderWorkReward(address _woid) public view returns (uint256 workReward)
	{
		return workOrderHub.getWorkReward(_woid);
	}

	function getWorkOrderStatus(address _woid) public view returns (IexecLib.WorkOrderStatusEnum status)
	{
		return workOrderHub.getStatus(_woid);
	}
	*/
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

	function rewardForConsensus(address _woid, address _scheduler, uint256 _amount) public returns (bool) // reward scheduler
	{
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(reward(_scheduler, _amount));
		return true;
	}

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
