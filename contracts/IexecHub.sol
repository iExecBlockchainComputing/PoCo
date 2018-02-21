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
	IexecLib.Position[] public m_orderBook;

	/**
	 * Events
	 */
	/* event PositionBid */
	/* event PositionBidCanceled */
	/* event PositionBidMarketed */
	// event PositionAsk
	// event PositionMarketedAsk (Accepted)
	// event WorkOrder // needed ?
	// event WorkOrderRevealing
	// event WorkOrderAborted
	// event WorkOrderCompleted

	/* event WorkOrder         (address woid, address workOrderOwner, address indexed workerPool, address indexed app, address indexed dataset); */
	event WorkOrderAccepted (address woid, address indexed workerPool);
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

	function createPositionBid(
		uint256 _category,
		uint256 _trust,
		uint256 _value,
		address _app,
		address _dataset,
		address _workerpool,
		string  _woParams,
		address _woBeneficiary,
		bool    _woCallback)
	public returns (uint)
	{
		// msg.sender = requester

		// APP
		require(appHub.isAppRegistred    (_app            ));
		require(appHub.isOpen            (_app            ));
		require(appHub.isDatasetAllowed  (_app, _dataset  ));
		require(appHub.isRequesterAllowed(_app, msg.sender));
		// Price to pay by the user, initialized with reward + dapp Price
		uint256 userCost = _value.add(appHub.getAppPrice(_app));

		// DATASET
		if (_dataset != address(0)) // address(0) → no dataset
		{
			require(datasetHub.isDatasetRegistred(_dataset            ));
			require(datasetHub.isOpen            (_dataset            ));
			require(datasetHub.isAppAllowed      (_dataset, _app      ));
			require(datasetHub.isRequesterAllowed(_dataset, msg.sender));
			if (_workerpool != address(0)) // address(0) → any workerpool
			{
				require(datasetHub.isWorkerPoolAllowed(_dataset, _workerpool));
			}
			// add optional datasetPrice for userCost
			userCost = userCost.add(datasetHub.getDatasetPrice(_dataset));
		}

		// WORKERPOOL
		if (_workerpool != address(0)) // address(0) → any workerPool
		{
			require(workerPoolHub.isWorkerPoolRegistred(_workerpool            ));
			require(workerPoolHub.isOpen               (_workerpool            ));
			require(workerPoolHub.isAppAllowed         (_workerpool, _app      ));
			require(workerPoolHub.isDatasetAllowed     (_workerpool, _dataset  ));
			// require(workerPoolHub.isRequesterAllowed   (_workerpool, msg.sender));
			require(appHub.isWorkerPoolAllowed(_app, _workerpool));
		}

		// msg.sender wanted here. not tx.origin. we can imagine a smart contract have RLC loaded and user can benefit from it.
		if (m_accounts[msg.sender].stake < userCost)
		{
			require(deposit(userCost.sub(m_accounts[msg.sender].stake))); // Only require the deposit of what is missing
		}
		require(lock(msg.sender, userCost)); // LOCK THE FUNDS FOR PAYMENT

		uint256                   positionIdx = m_orderBook.length;
		IexecLib.Position storage position    = m_orderBook[positionIdx];
		position.positionType  = IexecLib.PositionTypeEnum.BID;
		position.categorie     = _category;
		position.trust         = _trust;
		position.value         = _value;
		position.quantity      = 1;
		position.requester     = msg.sender;
		position.app           = _app;
		position.dataset       = _dataset;
		position.workerpool    = _workerpool;
		position.woParams      = _woParams;
		position.woBeneficiary = _woBeneficiary;
		position.woCallback    = _woCallback;
		position.locked        = userCost;
		position.workorder     =	address(0);

		// PositionBid(); // TODO create event
		return positionIdx;
	}

	function cancelPositionBid(uint256 _idx) public returns (bool)
	{
		IexecLib.Position storage position = m_orderBook[_idx];

		// sender must be requester
		require(position.requester == msg.sender);

		// position must still be active
		require(position.positionType == IexecLib.PositionTypeEnum.BID);
		position.positionType == IexecLib.PositionTypeEnum.CANCELED;

		require(unlock(position.requester, position.locked));

		// PositionBidCanceled(); // TODO create event
		return true;
	}

	function answerPositionBid(uint256 _positionIdx, address _workerpool) public returns (address)
	{
		IexecLib.Position storage position = m_orderBook[_positionIdx];

		// sender must own _workerpool
		require(workerPoolHub.getWorkerPoolOwner(_workerpool) == msg.sender);

		// position must be active
		require(position.positionType == IexecLib.PositionTypeEnum.BID);
		position.positionType = IexecLib.PositionTypeEnum.MARKETED;

		// Check worker pool affectation is compatible
		require(position.workerpool == address(0) || position.workerpool == _workerpool);
		position.workerpool == _workerpool;

		position.workorder = workOrderHub.createWorkOrder(
			_positionIdx,
			position.requester,
			position.app,
			position.dataset,
			_workerpool,
			position.value,
			position.trust,
			position.woParams,
			position.woBeneficiary,
			position.woCallback
		);
		require(WorkOrder(position.workorder).setActive());
		// require(lock(msg.sender, VALUE_TO_DETERMINE)); // TODO: scheduler stake
		require(WorkerPool(_workerpool).answerPositionBid(position.workorder));

		// PositionBidMarketed(); // TODO create event
		return position.workorder;
	}











/*
	function createPositionAsk() public returns (uint256)
	{
		return 0;
	}
	function cancelPositionAsk() public returns (uint256)
	{
		return 0;
	}
	function answerPositionAsk() public returns (address)
	{
		return 0;
	}
*/


	/*
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
			// require(workerPoolHub.isRequesterAllowed   (_workerPool, msg.sender));
			require(appHub.isWorkerPoolAllowed(_app, _workerPool));
		}

		// APP
		require(appHub.isAppRegistred    (_app            ));
		require(appHub.isOpen            (_app            ));
		require(appHub.isDatasetAllowed  (_app, _dataset  ));
		require(appHub.isRequesterAllowed(_app, msg.sender));

		// Price to pay by the user, initialized with reward + dapp Price
		uint256 userCost = _workReward.add(appHub.getAppPrice(_app));

		// DATASET
		if (_dataset != address(0)) // address(0) → no dataset
		{
			require(datasetHub.isDatasetRegistred(_dataset            ));
			require(datasetHub.isOpen            (_dataset            ));
			require(datasetHub.isAppAllowed      (_dataset, _app      ));
			require(datasetHub.isRequesterAllowed(_dataset, msg.sender));
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
		IexecLib.WorkOrderInfo storage woInfo = m_woInfos[newWorkOrder];
		woInfo.requesterAffectation  = msg.sender;
		woInfo.appAffectation        = _app;
		woInfo.datasetAffectation    = _dataset;
		woInfo.workerPoolAffectation = _workerPool;
		woInfo.userCost              = userCost;

		require(lock(woInfo.requesterAffectation, woInfo.userCost)); // LOCK THE FUNDS FOR PAYMENT

		// address newWorkOrder will the woid
		WorkOrder(newWorkOrder, msg.sender, _workerPool, _app, _dataset);
		return newWorkOrder;
	}
	*/

	/**
	 * WorkOrder life cycle
	 */

	/*
	function acceptWorkOrder(address _woid, address _workerPool) public returns (bool)
	{
		// sender must own _workerpool
		require(workerPoolHub.getWorkerPoolOwner(_workerPool) == msg.sender);
		// workorder must be pending
		require(getWorkOrderStatus(_woid) == IexecLib.WorkOrderStatusEnum.PENDING);

		// Check worker pool affectation is compatible
		IexecLib.WorkOrderInfo storage workorderinfo = m_woInfos[_woid];
		require(workorderinfo.workerPoolAffectation == address(0) || workorderinfo.workerPoolAffectation == _workerPool);
		workorderinfo.workerPoolAffectation = _workerPool;

		require(WorkerPool(_workerPool).acceptWorkOrder(
			_woid,
			getWorkOrderWorkReward(_woid),
			workorderinfo.appAffectation,
			workorderinfo.datasetAffectation
		));
		require(workOrderHub.setAccepted(_woid));
		// require(lock(msg.sender, VALUE_TO_DETERMINE)); // TODO: scheduler stake
		WorkOrderAccepted(_woid, _workerPool);
		return true;
	}
	*/

	function setRevealingStatus(address _woid) public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);
		require(workorder.m_workerpool() == msg.sender);
		require(workorder.m_status()     == IexecLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.setRevealing());
		WorkOrderRevealing(_woid, msg.sender); // msg.sender is workorder.m_workerpool()
		return true;
	}

	function reopen(address _woid) public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);
		require(workorder.m_workerpool() == msg.sender);
		require(workorder.m_status()     == IexecLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.setActive());
		WorkOrderAccepted(_woid, workorder.m_workerpool());
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

		IexecLib.Position storage position = m_orderBook[workorder.m_positionIdx()];
		require(unlock(position.requester, position.locked)); // UNLOCK THE FUNDS FOR REINBURSEMENT

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

		IexecLib.Position storage position = m_orderBook[workorder.m_positionIdx()];

		// reward app
		uint256 appPrice = appHub.getAppPrice(position.app);
		if (appPrice > 0)
		{
			require(reward(appHub.getAppOwner(position.app), appPrice));
			// TODO: to unlock a stake ?
		}
		// incremente app reputation?
		// reward dataset
		if (position.dataset != address(0))
		{
			uint256 datasetPrice = datasetHub.getDatasetPrice(position.dataset);
			if (datasetPrice > 0)
			{
				require(reward(datasetHub.getDatasetOwner(position.dataset), datasetPrice));
				// TODO: to unlock a stake ?
			}
			// incremente dataset reputation?
		}

		// take funds from requester
		require(seize(position.requester, position.locked)); // UNLOCK THE FUNDS FOR REINBURSEMENT

		// write results
		require(workorder.setResult(_stdout, _stderr, _uri));


		WorkOrderCompleted(_woid, position.workerpool);
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
