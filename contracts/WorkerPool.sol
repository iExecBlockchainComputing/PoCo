pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import './IexecHub.sol';
import "./SafeMathOZ.sol";
import "./AuthorizedList.sol";

contract WorkerPool is OwnableOZ, IexecHubAccessor // Owned by a S(w)
{
	using SafeMathOZ for uint256;

	enum WorkerPoolStatusEnum { OPEN, CLOSE }

	event WorkerPoolPolicyUpdate(
		uint256 oldStakeRatioPolicy,               uint256 newStakeRatioPolicy,
		uint256 oldSchedulerRewardRatioPolicy,     uint256 newSchedulerRewardRatioPolicy,
		uint256 oldSubscriptionMinimumStakePolicy, uint256 newSubscriptionMinimumStakePolicy,
		uint256 oldSubscriptionMinimumScorePolicy, uint256 newSubscriptionMinimumScorePolicy);

	/**
	 * Members
	 */
	string                      public m_name;
	uint256                     public m_stakeRatioPolicy;               // % of reward to stake
	uint256                     public m_schedulerRewardRatioPolicy;     // % of reward given to scheduler
	uint256                     public m_subscriptionLockStakePolicy;    // Stake locked when in workerpool - Constant set by constructor, do not update
	uint256                     public m_subscriptionMinimumStakePolicy; // Minimum stake for subscribing
	uint256                     public m_subscriptionMinimumScorePolicy; // Minimum score for subscribing
	WorkerPoolStatusEnum        public m_workerPoolStatus;
	address[]                   public m_workers;
	// mapping(address => index)
	mapping(address => uint256) public m_workerIndex;
	/**
	 * Address of slave/related contracts
	 */
	address                     public  m_workersAuthorizedListAddress;
	address                     private m_workerPoolHubAddress;




	uint256 public constant REVEAL_PERIOD_DURATION   = 3 hours;
	uint256 public constant CONSENSUS_DURATION_LIMIT = 7 days; // 7 days as the MVP here ;) https://ethresear.ch/t/minimal-viable-plasma/426

	struct WorkInfo
	{
		ConsensusStatusEnum status;
		uint256             schedulerReward;
		uint256             workersReward;
		uint256             stakeAmount;
		bytes32             consensus;
		uint256             revealDate;
		uint256             revealCounter;
		uint256             consensusTimout;
		address[]           contributors;
	}

	// mapping(taskID => WorkInfo)
	mapping(address => WorkInfo) public m_WorkInfos;


	enum ConsensusStatusEnum
	{
		UNSET,
		PENDING,
		CANCELED,
		STARTED,
		IN_PROGRESS,
		REACHED,
		/**
		 * FAILLED:
		 * After sometime, if the consensus is not reach, anyone with stake in
		 * it can abort the consensus and unlock all stake
		 */
		FAILLED,
		FINALIZED
	}


	enum WorkStatusEnum
	{
		UNSET,
		REQUESTED,
		SUBMITTED,
		POCO_REJECT,
		POCO_ACCEPT
	}

	struct Contribution
	{
		WorkStatusEnum status;
		bytes32        resultHash;
		bytes32        resultSign; // change from salt to tx.origin based signature
		address        enclaveChallenge;
	}

	/**
	 * Events
	 */
	event TaskReceived       (address indexed taskID);
	event TaskAccepted       (address indexed taskID);
	event TaskCanceled       (address indexed taskID);
	event CallForContribution(address indexed taskID, address indexed worker, uint256 workerScore);
	event Contribute         (address indexed taskID, address indexed worker, bytes32 resultHash);
	event RevealConsensus    (address indexed taskID, bytes32 consensus);
	event Reveal             (address indexed taskID, address indexed worker, bytes32 result, WorkStatusEnum pocoStatus);

	/**
	 * Members
	 */

	// mapping( taksID => worker address => Contribution);
	mapping( address => mapping ( address => Contribution ) ) public  m_tasksContributions;
	//mapping( address => address[] )                           public  m_tasksWorkers;
	mapping( address => uint256)      private m_workerWeights; // used by rewardTask





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
		m_stakeRatioPolicy               = 30; // % of the task price to stake → cf function SubmitTask
		m_schedulerRewardRatioPolicy     = 1;  // % of the task reward going to scheduler vs workers reward
		m_subscriptionLockStakePolicy    = _subscriptionLockStakePolicy; // only at creation. cannot be change to respect lock/unlock of worker stake
		m_subscriptionMinimumStakePolicy = _subscriptionMinimumStakePolicy;
		m_subscriptionMinimumScorePolicy = _subscriptionMinimumScorePolicy;
		m_workerPoolStatus               = WorkerPoolStatusEnum.OPEN;
		m_workerPoolHubAddress           = msg.sender;

		/*
		   cannot do the following AuthorizedList contracts creation because of :
		   VM Exception while processing transaction: out of gas at deploy.
		   use attach....AuthorizedListContract instead function
		*/

	  m_workersAuthorizedListAddress = new AuthorizedList(AuthorizedList.ListPolicyEnum.WHITELIST);
	  AuthorizedList(m_workersAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin
		/*
		dappsAuthorizedListAddress = new AuthorizedList();
		AuthorizedList(dappsAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin
		requesterAuthorizedListAddress = new AuthorizedList();
		AuthorizedList(requesterAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin
		*/
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
	function addWorker(address _worker) public onlyWorkerPoolHub  returns (bool)
	{
		uint index = m_workers.push(_worker);
		m_workerIndex[_worker] = index;
		return true;
	}
	function removeWorker(address _worker) public onlyWorkerPoolHub returns (bool)
	{
		uint index = getWorkerIndex(_worker); // fails if worker not registered
		m_workers[index] = m_workers[m_workers.length-1];
		delete m_workers[m_workers.length-1];
		m_workers.length--;
		return true;
	}

	/************************* open / close mechanisms *************************/
	/*
	function open() public onlyIexecHub returns (bool)
	{
		require(m_workerPoolStatus == WorkerPoolStatusEnum.CLOSE);
		m_workerPoolStatus = WorkerPoolStatusEnum.OPEN;
		return true;
	}

	function close() public onlyIexecHub returns (bool)
	{
		require(m_workerPoolStatus == WorkerPoolStatusEnum.OPEN);
		m_workerPoolStatus = WorkerPoolStatusEnum.CLOSE;
		return true;
	}
	*/



	function switchOnOff(bool onoff) public onlyIexecHub /*for staking management*/ returns (bool)
	{
		if(onoff){
			require(m_workerPoolStatus == WorkerPoolStatusEnum.CLOSE);
			m_workerPoolStatus = WorkerPoolStatusEnum.OPEN;
		}
		else{
			require(m_workerPoolStatus == WorkerPoolStatusEnum.OPEN);
			m_workerPoolStatus = WorkerPoolStatusEnum.CLOSE;
		}
		return true;
	}

	function isOpen() public view returns (bool)
	{
		return m_workerPoolStatus == WorkerPoolStatusEnum.OPEN;
	}

	function getWorkInfo(address _taskID) public view returns (
		ConsensusStatusEnum status,
		uint256             schedulerReward,
		uint256             workersReward,
		uint256             stakeAmount,
		bytes32             consensus,
		uint256             revealDate,
		uint256             revealCounter,
		uint256             consensusTimout
		) {
		WorkInfo  workinfo = m_WorkInfos[_taskID];
		return (
		 workinfo.status,
		 workinfo.schedulerReward,
		 workinfo.workersReward,
		 workinfo.stakeAmount,
		 workinfo.consensus,
		 workinfo.revealDate,
		 workinfo.revealCounter,
		 workinfo.consensusTimout
		 );
	}




	/**************************** tasks management *****************************/
	function receivedTask(address _taskID, uint256 _taskCost) public onlyIexecHub returns (bool)
	{
		require(isOpen());
		WorkInfo storage workinfo = m_WorkInfos[_taskID];
		workinfo.status = ConsensusStatusEnum.PENDING;
		workinfo.schedulerReward = _taskCost.percentage(m_schedulerRewardRatioPolicy);
		workinfo.workersReward = _taskCost.sub(workinfo.schedulerReward);
		workinfo.stakeAmount = _taskCost.percentage(m_stakeRatioPolicy);
		TaskReceived(_taskID);
		return true;
	}

	function cancelTask(address _taskID) public onlyIexecHub returns (bool)
	{
		WorkInfo storage workinfo = m_WorkInfos[_taskID];
		require(workinfo.status == ConsensusStatusEnum.PENDING);
		workinfo.status = ConsensusStatusEnum.CANCELED;
		TaskCanceled(_taskID);
		return true;
	}


	function acceptTask(address _taskID) public onlyOwner returns (bool)
	{
		WorkInfo storage workinfo = m_WorkInfos[_taskID];
		require(workinfo.status == ConsensusStatusEnum.PENDING);
		require(iexecHubInterface.acceptTask(_taskID));
		workinfo.status = ConsensusStatusEnum.STARTED;
		workinfo.consensusTimout = CONSENSUS_DURATION_LIMIT.add(now);
		TaskAccepted(_taskID);
		return true;
	}

	function claimFailedConsensus(address _taskID) public onlyIexecHub returns (bool)
	{
	  WorkInfo storage workinfo = m_WorkInfos[_taskID];
		require(workinfo.status == ConsensusStatusEnum.IN_PROGRESS || workinfo.status == ConsensusStatusEnum.STARTED);
		require(now > workinfo.consensusTimout);
		workinfo.status = ConsensusStatusEnum.FAILLED;
		uint256 i;
		address w;
		for (i = 0; i<workinfo.contributors.length; ++i)
		{
			w = workinfo.contributors[i];
			if (m_tasksContributions[_taskID][w].status != WorkStatusEnum.REQUESTED)
			{
 				require(iexecHubInterface.unlockForTask(_taskID, w, workinfo.stakeAmount));
			}
		}
		return true;
	}

	function callForContribution(address _taskID, address _worker, address _enclaveChallenge) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		WorkInfo storage workinfo = m_WorkInfos[_taskID];
		require(workinfo.status == ConsensusStatusEnum.IN_PROGRESS || workinfo.status == ConsensusStatusEnum.STARTED);
		workinfo.status = ConsensusStatusEnum.IN_PROGRESS;
		Contribution storage contribution = m_tasksContributions[_taskID][_worker];

		// random worker selection ? :
		// Can use a random selection trick by using block.blockhash (256 most recent blocks accessible) and a modulo list of workers not yet called.
		address workerPool;
		uint256 workerScore;
		(workerPool, workerScore) = iexecHubInterface.getWorkerStatus(_worker); // workerPool, workerScore
		require(workerPool == address(this));

		require(contribution.status == WorkStatusEnum.UNSET );
		contribution.status = WorkStatusEnum.REQUESTED;
		contribution.enclaveChallenge = _enclaveChallenge;

		CallForContribution(_taskID,_worker, workerScore);
		return true;
	}

	function contribute(address _taskID, bytes32 _resultHash, bytes32 _resultSign, uint8 _v, bytes32 _r, bytes32 _s) public returns (uint256 workerStake)
	{
		WorkInfo storage workinfo = m_WorkInfos[_taskID];
		require(workinfo.status == ConsensusStatusEnum.IN_PROGRESS);
		Contribution storage contribution = m_tasksContributions[_taskID][msg.sender];

		// msg.sender = a worker
		// tx.origin = a worker
		require(_resultHash != 0x0);
		require(_resultSign != 0x0);
		if (contribution.enclaveChallenge != address(0))
		{
				require(contribution.enclaveChallenge == ecrecover(keccak256(_resultHash ^ _resultSign),  _v,  _r,  _s));
		}

		require(contribution.status == WorkStatusEnum.REQUESTED);
		contribution.status     = WorkStatusEnum.SUBMITTED;
		contribution.resultHash = _resultHash;
		contribution.resultSign = _resultSign;
		workinfo.contributors.push(msg.sender);

		require(iexecHubInterface.lockForTask(_taskID, msg.sender, workinfo.stakeAmount));
		Contribute(_taskID, msg.sender, _resultHash);
		return workinfo.stakeAmount;
	}

	function revealConsensus(address _taskID, bytes32 _consensus) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		WorkInfo storage workinfo = m_WorkInfos[_taskID];
		require(workinfo.status == ConsensusStatusEnum.IN_PROGRESS); // or state Locked to add ?
		require(workinfo.contributors.length > 0); // you cannot revealConsensus if you do not have callForContribution and no worker have contribute
		workinfo.status     = ConsensusStatusEnum.REACHED;
		workinfo.consensus  = _consensus;
		workinfo.revealDate = REVEAL_PERIOD_DURATION.add(now);
		RevealConsensus(_taskID, _consensus);
		return true;
	}

	function reveal(address _taskID, bytes32 _result) public returns (bool)
	{
		WorkInfo storage workinfo = m_WorkInfos[_taskID];
		require(workinfo.status == ConsensusStatusEnum.REACHED);
		Contribution storage contribution = m_tasksContributions[_taskID][msg.sender];

		require(workinfo.revealDate > now);
		require(contribution.status == WorkStatusEnum.SUBMITTED);

		bool validHash = keccak256(_result                        ) == contribution.resultHash;
		bool validSign = keccak256(_result ^ keccak256(msg.sender)) == contribution.resultSign;

		contribution.status = (validHash && validSign) ? WorkStatusEnum.POCO_ACCEPT : WorkStatusEnum.POCO_REJECT;
		workinfo.revealCounter = workinfo.revealCounter.add(1);

		Reveal(_taskID, msg.sender, _result, contribution.status); // TODO add WorkStatusEnum in LOG
		return true;
	}

	// if sheduler never call finalized ? no incetive to do that. schedulermust be pay also at this time
	function finalizedTask(address _taskID, string _stdout, string _stderr, string _uri) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		WorkInfo storage workinfo = m_WorkInfos[_taskID];
		require(workinfo.status == ConsensusStatusEnum.REACHED);

		require(workinfo.revealDate <= now || workinfo.revealCounter == workinfo.contributors.length);
		workinfo.status = ConsensusStatusEnum.FINALIZED;

		// add penalized to the call worker to contrubution and they never contribute ?
		require(rewardTask(_taskID,workinfo));

		require(iexecHubInterface.finalizedTask(_taskID, _stdout, _stderr, _uri, workinfo.schedulerReward));
		return true;
	}

	function rewardTask(address _taskID, WorkInfo _workinfo) internal returns (bool)
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
		uint256 totalReward = _workinfo.workersReward;
		address[] memory contributors = _workinfo.contributors;
		for (i = 0; i<contributors.length; ++i)
		{
			w = contributors[i];
			if (m_tasksContributions[_taskID][w].status == WorkStatusEnum.POCO_ACCEPT)
			{
				workerBonus        = (m_tasksContributions[_taskID][w].enclaveChallenge != address(0)) ? 3 : 1; // TODO: bonus sgx = 3 ?
				(,workerScore)     = iexecHubInterface.getWorkerStatus(w);
				workerWeight       = 1 + workerScore.mul(workerBonus).log2();
				totalWeight        = totalWeight.add(workerWeight);
				m_workerWeights[w] = workerWeight; // store so we don't have to recompute
			}
			else // WorkStatusEnum.POCO_REJECT or WorkStatusEnum.SUBMITTED (not revealed)
			{
				totalReward = totalReward.add(_workinfo.stakeAmount);
			}
		}

		require(totalWeight > 0);
		uint256 remainingReward = totalReward;

		for (i = 0; i<contributors.length; ++i)
		{
			w = contributors[i];
			if (m_tasksContributions[_taskID][w].status == WorkStatusEnum.POCO_ACCEPT)
			{
				workerReward    = totalReward.mulByFraction(m_workerWeights[w], totalWeight);
				remainingReward = remainingReward.sub(workerReward);
				require(iexecHubInterface.unlockForTask(_taskID, w, _workinfo.stakeAmount)); // should failed if no locked ?
				require(iexecHubInterface.rewardForTask(_taskID, w, workerReward));
			}
			else // WorkStatusEnum.POCO_REJECT or WorkStatusEnum.SUBMITTED (not revealed)
			{
				require(iexecHubInterface.seizeForTask(_taskID, w, _workinfo.stakeAmount));
				// No Reward
			}
		}
		// We have remainingReward left for someone → who ?
		return true;
	}







}
