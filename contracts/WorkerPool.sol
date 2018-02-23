pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import './IexecHub.sol';
import "./SafeMathOZ.sol";
import "./AuthorizedList.sol";
import "./WorkOrder.sol";
import './IexecLib.sol';

contract WorkerPool is OwnableOZ, IexecHubAccessor // Owned by a S(w)
{
	using SafeMathOZ for uint256;

	enum WorkerPoolStatusEnum { OPEN, CLOSE }

	/**
	 * Members
	 */
	WorkerPoolStatusEnum        public m_workerPoolStatus;
	string                      public m_name;
	uint256                     public m_stakeRatioPolicy;               // % of reward to stake
	uint256                     public m_schedulerRewardRatioPolicy;     // % of reward given to scheduler
	uint256                     public m_subscriptionLockStakePolicy;    // Stake locked when in workerpool - Constant set by constructor, do not update
	uint256                     public m_subscriptionMinimumStakePolicy; // Minimum stake for subscribing
	uint256                     public m_subscriptionMinimumScorePolicy; // Minimum score for subscribing
	address[]                   public m_workers;
	mapping(address => uint256) public m_workerIndex;

	// mapping(woid => IexecLib.Consensus)
	mapping(address => IexecLib.Consensus) public m_consensus;
	// mapping(woid => worker address => Contribution);
	mapping(address => mapping(address => IexecLib.Contribution)) public m_contributions;

	uint256 public constant REVEAL_PERIOD_DURATION   = 3 hours;
	uint256 public constant CONSENSUS_DURATION_LIMIT = 7 days; // 7 days as the MVP here ;) https://ethresear.ch/t/minimal-viable-plasma/426

	/**
	 * Address of slave/related contracts
	 */
	address private m_workerPoolHubAddress;
	address public  m_appsAuthorizedListAddress;
	address public  m_datasetsAuthorizedListAddress;
	/* address public  m_requestersAuthorizedListAddress; */
	address public  m_workersAuthorizedListAddress;

	/**
	 * Events
	 */
	event WorkerPoolPolicyUpdate(
		uint256 oldStakeRatioPolicy,               uint256 newStakeRatioPolicy,
		uint256 oldSchedulerRewardRatioPolicy,     uint256 newSchedulerRewardRatioPolicy,
		uint256 oldSubscriptionMinimumStakePolicy, uint256 newSubscriptionMinimumStakePolicy,
		uint256 oldSubscriptionMinimumScorePolicy, uint256 newSubscriptionMinimumScorePolicy);

	event WorkOrderActive    (address indexed woid);
	event CallForContribution(address indexed woid, address indexed worker, uint256 workerScore);
	event Contribute         (address indexed woid, address indexed worker, bytes32 resultHash);
	event RevealConsensus    (address indexed woid, bytes32 consensus);
	event Reveal             (address indexed woid, address indexed worker, bytes32 result);

	/**
	 * Modifiers
	 */
	modifier onlyWorkerPoolHub()
	{
		require(msg.sender == m_workerPoolHubAddress);
		_;
	}

	/**
	 * Methods
	 */
	// Constructor
	function WorkerPool(
		address _iexecHubAddress,
		string  _name,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender ==  WorkerPoolHub
		require(tx.origin != msg.sender);
		transferOwnership(tx.origin); // owner → tx.origin

		m_name                           = _name;
		m_stakeRatioPolicy               = 30; // % of the work order price to stake
		m_schedulerRewardRatioPolicy     = 1;  // % of the work reward going to scheduler vs workers reward
		m_subscriptionLockStakePolicy    = _subscriptionLockStakePolicy; // only at creation. cannot be change to respect lock/unlock of worker stake
		m_subscriptionMinimumStakePolicy = _subscriptionMinimumStakePolicy;
		m_subscriptionMinimumScorePolicy = _subscriptionMinimumScorePolicy;
		m_workerPoolStatus               = WorkerPoolStatusEnum.OPEN;
		m_workerPoolHubAddress           = msg.sender;

		m_appsAuthorizedListAddress       = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		m_datasetsAuthorizedListAddress   = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		/* m_requestersAuthorizedListAddress = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST); */
		m_workersAuthorizedListAddress    = new AuthorizedList(AuthorizedList.ListPolicyEnum.WHITELIST);
		AuthorizedList(m_appsAuthorizedListAddress      ).transferOwnership(tx.origin); // owner → tx.origin
		AuthorizedList(m_datasetsAuthorizedListAddress  ).transferOwnership(tx.origin); // owner → tx.origin
		/* AuthorizedList(m_requestersAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin */
		AuthorizedList(m_workersAuthorizedListAddress   ).transferOwnership(tx.origin); // owner → tx.origin
	}

	function changeWorkerPoolPolicy(
		uint256 _newStakeRatioPolicy,
		uint256 _newSchedulerRewardRatioPolicy,
		uint256 _newResultRetentionPolicy,
		uint256 _newSubscriptionMinimumStakePolicy,
		uint256 _newSubscriptionMinimumScorePolicy)
	public onlyOwner
	{
		WorkerPoolPolicyUpdate(
			m_stakeRatioPolicy,               _newStakeRatioPolicy,
			m_schedulerRewardRatioPolicy,     _newSchedulerRewardRatioPolicy,
			m_subscriptionMinimumStakePolicy, _newSubscriptionMinimumStakePolicy,
			m_subscriptionMinimumScorePolicy, _newSubscriptionMinimumScorePolicy
		);
		m_stakeRatioPolicy               = _newStakeRatioPolicy;
		m_schedulerRewardRatioPolicy     = _newSchedulerRewardRatioPolicy;
		m_subscriptionMinimumStakePolicy = _newSubscriptionMinimumStakePolicy;
		m_subscriptionMinimumScorePolicy = _newSubscriptionMinimumScorePolicy;
	}

	function getWorkerPoolOwner() public view returns (address)
	{
		return m_owner;
	}

	/************************* worker list management **************************/
	function isAppAllowed(address _app) public returns (bool)
	{
		return AuthorizedList(m_appsAuthorizedListAddress).isActorAllowed(_app);
	}
	function isDatasetAllowed(address _dataset) public view returns (bool)
	{
		return AuthorizedList(m_datasetsAuthorizedListAddress).isActorAllowed(_dataset);
	}
	/*
	function isRequesterAllowed(address _requester) public view returns (bool)
	{
		return AuthorizedList(m_requestersAuthorizedListAddress).isActorAllowed(_requester);
	}
	*/
	function isWorkerAllowed(address _worker) public view returns (bool)
	{
		return AuthorizedList(m_workersAuthorizedListAddress).isActorAllowed(_worker);
	}

	function getWorkerAddress(uint _index) constant public returns (address)
	{
		return m_workers[_index];
	}
	function getWorkerIndex(address _worker) constant public returns (uint)
	{
		uint index = m_workerIndex[_worker];
		require(m_workers[index] == _worker);
		return index;
	}
	function getWorkersCount() constant public returns (uint)
	{
		return m_workers.length;
	}

	function subscribeToPool() public returns (bool){
		//tx.origin = worker
	  require(iexecHubInterface.subscribeToPool());
		uint index = m_workers.push(tx.origin);
		m_workerIndex[tx.origin] = index;
		return true;
	}

	function unsubscribeToPool() public  returns (bool){
		//tx.origin = worker
		require(iexecHubInterface.unsubscribeToPool());
		require(removeWorker(tx.origin));
		return true;
	}

	function evictWorker(address _worker) public onlyOwner returns (bool){
		//tx.origin = worker
		require(iexecHubInterface.evictWorker(_worker));
	  require(removeWorker(_worker));
		return true;
	}

	function removeWorker(address _worker) internal returns (bool)
	{
		uint index = getWorkerIndex(_worker); // fails if worker not registered
		m_workers[index] = m_workers[m_workers.length-1];
		delete m_workers[m_workers.length-1];
		m_workers.length--;
		return true;
	}

	/************************* open / close mechanisms *************************/
	function switchOnOff(bool onoff) public onlyIexecHub /*for staking management*/ returns (bool)
	{
		if (onoff)
		{
			require(m_workerPoolStatus == WorkerPoolStatusEnum.CLOSE);
			m_workerPoolStatus = WorkerPoolStatusEnum.OPEN;
		}
		else
		{
			require(m_workerPoolStatus == WorkerPoolStatusEnum.OPEN);
			m_workerPoolStatus = WorkerPoolStatusEnum.CLOSE;
		}
		return true;
	}

	function isOpen() public view returns (bool)
	{
		return m_workerPoolStatus == WorkerPoolStatusEnum.OPEN;
	}

	function getConsensusDetails(address _woid) public view returns (
		uint256, // reward
		uint256, // stake
		bytes32, // consensus
		uint256, // revealDate
		uint256, // revealCounter
		uint256) // consensusTimout
	{
		IexecLib.Consensus storage consensus = m_consensus[_woid];
		return (
			consensus.poolReward,
			consensus.stakeAmount,
			consensus.consensus,
			consensus.revealDate,
			consensus.revealCounter,
			consensus.consensusTimout
		);
	}

	/**************************** Works management *****************************/
	function emitWorkOrder(address _woid) public onlyIexecHub returns (bool)
	{
		require(isOpen          ()                            );
		require(isAppAllowed    (WorkOrder(_woid).m_app()    ));
		require(isDatasetAllowed(WorkOrder(_woid).m_dataset()));

		IexecLib.Consensus storage consensus = m_consensus[_woid];

		uint256 reward = WorkOrder(_woid).m_reward();
		consensus.poolReward      = reward;
		consensus.stakeAmount     = reward.percentage(m_stakeRatioPolicy);
		consensus.consensusTimout = CONSENSUS_DURATION_LIMIT.add(now);

		WorkOrderActive(_woid);
		return true;
	}

	function claimFailedConsensus(address _woid) public onlyIexecHub returns (bool)
	{
	  IexecLib.Consensus storage consensus = m_consensus[_woid];
		require(now > consensus.consensusTimout);
		uint256 i;
		address w;
		for (i = 0; i < consensus.contributors.length; ++i)
		{
			w = consensus.contributors[i];
			if (m_contributions[_woid][w].status != IexecLib.ContributionStatusEnum.AUTHORIZED)
			{
 				require(iexecHubInterface.unlockForWork(_woid, w, consensus.stakeAmount));
			}
		}
		return true;
	}

	function callForContributions(address _woid, address[] _workers, address _enclaveChallenge) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		for (uint i = 0; i < _workers.length; ++i)
		{
			require(callForContribution(_woid, _workers[i], _enclaveChallenge));
		}
		return true;
	}

	function callForContribution(address _woid, address _worker, address _enclaveChallenge) public onlyOwner /*onlySheduler*/ returns (bool)
	{
	require(iexecHubInterface.getWorkOrderStatus(_woid) == IexecLib.WorkOrderStatusEnum.ACTIVE);
		IexecLib.Consensus    storage consensus    = m_consensus[_woid];
		IexecLib.Contribution storage contribution = m_contributions[_woid][_worker];

		// random worker selection ? :
		// Can use a random selection trick by using block.blockhash (256 most recent blocks accessible) and a modulo list of workers not yet called.
		address workerPool;
		uint256 workerScore;
		(workerPool, workerScore) = iexecHubInterface.getWorkerStatus(_worker); // workerPool, workerScore
		require(workerPool == address(this));

		require(contribution.status == IexecLib.ContributionStatusEnum.UNSET);
		contribution.status           = IexecLib.ContributionStatusEnum.AUTHORIZED;
		contribution.enclaveChallenge = _enclaveChallenge;

		CallForContribution(_woid, _worker, workerScore);
		return true;
	}

	function contribute(address _woid, bytes32 _resultHash, bytes32 _resultSign, uint8 _v, bytes32 _r, bytes32 _s) public returns (uint256 workerStake)
	{
		IexecLib.Consensus    storage consensus    = m_consensus[_woid];
		IexecLib.Contribution storage contribution = m_contributions[_woid][msg.sender];

		// msg.sender = a worker
		// tx.origin = a worker
		require(_resultHash != 0x0);
		require(_resultSign != 0x0);
		if (contribution.enclaveChallenge != address(0))
		{
				require(contribution.enclaveChallenge == ecrecover(keccak256(_resultHash ^ _resultSign),  _v,  _r,  _s));
		}

		require(contribution.status == IexecLib.ContributionStatusEnum.AUTHORIZED);
		contribution.status     = IexecLib.ContributionStatusEnum.CONTRIBUTED;
		contribution.resultHash = _resultHash;
		contribution.resultSign = _resultSign;
		consensus.contributors.push(msg.sender);

		require(iexecHubInterface.lockForWork(_woid, msg.sender, consensus.stakeAmount));
		Contribute(_woid, msg.sender, _resultHash);
		return consensus.stakeAmount;
	}

	function revealConsensus(address _woid, bytes32 _consensus) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		IexecLib.Consensus storage consensus = m_consensus[_woid];

		require(iexecHubInterface.startRevealingPhase(_woid));

		consensus.winnerCount = 0;
		for (uint256 i = 0; i<consensus.contributors.length; ++i)
		{
			address w = consensus.contributors[i];
			if (m_contributions[_woid][w].resultHash == _consensus)
			{
				consensus.winnerCount = consensus.winnerCount.add(1);
			}
		}
		require(consensus.winnerCount > 0); // you cannot revealConsensus if no worker has contributed to this hash

		consensus.consensus  = _consensus;
		consensus.revealDate = REVEAL_PERIOD_DURATION.add(now);
		RevealConsensus(_woid, _consensus);
		return true;
	}

	function reveal(address _woid, bytes32 _result) public returns (bool)
	{
		IexecLib.Consensus    storage consensus    = m_consensus[_woid];
		IexecLib.Contribution storage contribution = m_contributions[_woid][msg.sender];

		require(iexecHubInterface.getWorkOrderStatus(_woid) == IexecLib.WorkOrderStatusEnum.REVEALING);
		require(consensus.revealDate     >  now                                        ); // Needed ?
		require(contribution.status      == IexecLib.ContributionStatusEnum.CONTRIBUTED);
		require(contribution.resultHash  == consensus.consensus                        );
		require(contribution.resultHash  == keccak256(_result                        ) );
		require(contribution.resultSign  == keccak256(_result ^ keccak256(msg.sender)) );

		contribution.status     = IexecLib.ContributionStatusEnum.PROVED;
		consensus.revealCounter = consensus.revealCounter.add(1);

		Reveal(_woid, msg.sender, _result); // TODO add WorkStatusEnum in LOG
		return true;
	}

	function reopen(address _woid) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		IexecLib.Consensus storage consensus = m_consensus[_woid];
		require(consensus.revealDate <= now && consensus.revealCounter == 0);
		require(iexecHubInterface.reopen(_woid));
		// Reset to status before revealConsensus
		consensus.winnerCount = 0;
		consensus.consensus   = 0x0;
		consensus.revealDate  = 0;

		for (uint256 i = 0; i < consensus.contributors.length; ++i)
		{
			address w = consensus.contributors[i];
			if (m_contributions[_woid][w].resultHash == consensus.consensus)
			{
				m_contributions[_woid][w].status = IexecLib.ContributionStatusEnum.REJECTED;
			}
		}
		return true;
	}

	// if sheduler never call finalized ? no incetive to do that. schedulermust be pay also at this time
	function finalizedWork(address _woid, string _stdout, string _stderr, string _uri) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		IexecLib.Consensus storage consensus = m_consensus[_woid];
		require((consensus.revealDate <= now && consensus.revealCounter > 0) || consensus.revealCounter == consensus.winnerCount);

		// add penalized to the call worker to contrubution and they never contribute ?
		require(distributeRewards(_woid, consensus));

		require(iexecHubInterface.finalizedWorkOrder(_woid, _stdout, _stderr, _uri));
		return true;
	}

	function distributeRewards(address _woid, IexecLib.Consensus _consensus) internal returns (bool)
	{
		uint256 i;
		address w;
		/**
		 * Reward distribution:
		 * totalReward is to be distributed amoung the winners relative to their
		 * contribution. I believe that the weight should be someting like:
		 *
		 * w ~= 1+log(score*bonus)
		 *
		 * Is it worth the gaz necessay to compute the log?
		 * → https://ethereum.stackexchange.com/questions/8086/logarithm-math-operation-in-solidity#8110
		 */
		uint256 workerBonus;
		uint256 workerScore;
		uint256 workerWeight;
		uint256 totalWeight;
		uint256 workerReward;
		uint256 totalReward = _consensus.poolReward;
		address[] memory contributors = _consensus.contributors;
		for (i = 0; i<contributors.length; ++i)
		{
			w = contributors[i];
			if (m_contributions[_woid][w].status == IexecLib.ContributionStatusEnum.PROVED)
			{
				workerBonus                      = (m_contributions[_woid][w].enclaveChallenge != address(0)) ? 3 : 1; // TODO: bonus sgx = 3 ?
				(,workerScore)                   = iexecHubInterface.getWorkerStatus(w);
				workerWeight                     = 1 + workerScore.mul(workerBonus).log2();
				totalWeight                      = totalWeight.add(workerWeight);
				m_contributions[_woid][w].weight = workerWeight; // store so we don't have to recompute
			}
			else // ContributionStatusEnum.REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				totalReward = totalReward.add(_consensus.stakeAmount);
			}
		}
		require(totalWeight > 0);

		// compute how much is going to the workers
		uint256 workersReward = totalReward.percentage(uint256(100).sub(m_schedulerRewardRatioPolicy));

		for (i = 0; i<contributors.length; ++i)
		{
			w = contributors[i];
			if (m_contributions[_woid][w].status == IexecLib.ContributionStatusEnum.PROVED)
			{
				workerReward = workersReward.mulByFraction(m_contributions[_woid][w].weight, totalWeight);
				totalReward  = totalReward.sub(workerReward);
				require(iexecHubInterface.unlockForWork(_woid, w, _consensus.stakeAmount));
				require(iexecHubInterface.rewardForWork(_woid, w, workerReward));
			}
			else // WorkStatusEnum.POCO_REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				require(iexecHubInterface.seizeForWork(_woid, w, _consensus.stakeAmount));
				// No Reward
			}
		}
		// totalReward now contains the scheduler share
		require(iexecHubInterface.rewardForConsensus(_woid, tx.origin, totalReward)); // tx.origin == m_owner
		return true;
	}

}
