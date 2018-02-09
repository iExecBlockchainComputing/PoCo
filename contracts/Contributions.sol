pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import "./SafeMathOZ.sol";
import './IexecHubAccessor.sol';


contract Contributions is OwnableOZ, IexecHubAccessor // Owned by a S(w)
{
	using SafeMathOZ for uint256;

	uint256 public constant REVEAL_PERIOD_DURATION   = 3 hours;
	uint256 public constant CONSENSUS_DURATION_LIMIT = 7 days; // 7 days as the MVP here ;) https://ethresear.ch/t/minimal-viable-plasma/426

  address             public m_workerPool;
	address             public m_taskID;
	ConsensusStatusEnum public m_status;
	uint256             public m_schedulerReward;
	uint256             public m_workersReward;
	uint256             public m_stakeAmount;
	bytes32             public m_consensus;
	uint256             public m_revealDate;
	uint256             public m_revealCounter;
	uint256             public m_consensusTimout;
	bool                public m_enclaveGuarantee;

	enum ConsensusStatusEnum
	{
		UNSET,
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

	event CallForContribution(address indexed worker, uint256 workerScore);
	event Contribute         (address indexed worker, bytes32 resultHash);
	event RevealConsensus    (bytes32 consensus);
	event Reveal             (address indexed worker, bytes32 result, WorkStatusEnum pocoStatus);

	/**
	 * Members
	 */

	// mapping( worker address => Work);
	mapping(address => Contribution) public m_tasksContributions;
	address[]                        public m_tasksWorkers;

	/**
	 * Methods
	 */

	// Constructor
	function Contributions(
		address _iexecHubAddress,
		address _taskID,
		uint256 _workersReward,
		uint256 _schedulerReward,
		uint256 _stakeAmount,
		bool    _enclaveGuarantee)
	OwnableOZ() // owner is WorkerPool contract
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		m_taskID          = _taskID;
		m_status          = ConsensusStatusEnum.IN_PROGRESS;
	  m_stakeAmount     = _stakeAmount;
		m_workerPool      = msg.sender;
		m_workersReward   = _workersReward;
		m_schedulerReward = _schedulerReward;
		m_consensusTimout = CONSENSUS_DURATION_LIMIT.add(now);
		m_enclaveGuarantee    = _enclaveGuarantee;
		transferOwnership(tx.origin); // scheduler (tx.origin) become owner at this moment
		// how this m_stakeAmount is used for ?
		// require(iexecHubInterface.lockForTask(_taskID, tx.origin, m_stakeAmount));
	}


	function claimFailedConsensus() public onlyIexecHub returns (bool)
	{
		require(m_status == ConsensusStatusEnum.IN_PROGRESS);
		require(now > m_consensusTimout);
		m_status = ConsensusStatusEnum.FAILLED;
		uint256 i;
		address w;
		for (i = 0; i<m_tasksWorkers.length; ++i)
		{
			w = m_tasksWorkers[i];
			if (m_tasksContributions[w].status != WorkStatusEnum.REQUESTED)
			{
 				require(iexecHubInterface.unlockForTask(m_taskID, w, m_stakeAmount));
			}
		}
		return true;
	}

	function callForContribution(address _worker, address _enclaveChallenge) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		require(m_status == ConsensusStatusEnum.IN_PROGRESS);
		Contribution storage contribution = m_tasksContributions[_worker];

		// random worker selection ? :
		// Can use a random selection trick by using block.blockhash (256 most recent blocks accessible) and a modulo list of workers not yet called.
		address workerPool;
		uint256 workerScore;
		(workerPool, workerScore) = iexecHubInterface.getWorkerStatus(_worker); // workerPool, workerScore
		require(workerPool == m_workerPool);

		require(contribution.status == WorkStatusEnum.UNSET );
		contribution.status = WorkStatusEnum.REQUESTED;
		contribution.enclaveChallenge=_enclaveChallenge;

		CallForContribution(_worker, workerScore);
		return true;
	}

	function contribute(bytes32 _resultHash, bytes32 _resultSign, uint8 _v, bytes32 _r, bytes32 _s) public returns (uint256 workerStake)
	{
		require(m_status == ConsensusStatusEnum.IN_PROGRESS);
		Contribution storage contribution = m_tasksContributions[msg.sender];

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
		m_tasksWorkers.push(msg.sender);

		require(iexecHubInterface.lockForTask(m_taskID, msg.sender, m_stakeAmount));
		Contribute(msg.sender, _resultHash);
		return m_stakeAmount;
	}

	function revealConsensus(bytes32 _consensus) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		require(m_status == ConsensusStatusEnum.IN_PROGRESS); // or state Locked to add ?

		require(m_tasksWorkers.length > 0); // you cannot revealConsensus if you do not have callForContribution and no worker have contribute
		m_status     = ConsensusStatusEnum.REACHED;
		m_consensus  = _consensus;
		m_revealDate = REVEAL_PERIOD_DURATION.add(now);
		RevealConsensus(_consensus);
		return true;
	}

	function reveal(bytes32 _result) public returns (bool)
	{
		require(m_status == ConsensusStatusEnum.REACHED);
		Contribution storage contribution = m_tasksContributions[msg.sender];

		require(m_revealDate > now);
		require(contribution.status == WorkStatusEnum.SUBMITTED);

		bool validHash = keccak256(_result                        ) == contribution.resultHash;
		bool validSign = keccak256(_result ^ keccak256(msg.sender)) == contribution.resultSign;

		contribution.status = (validHash && validSign) ? WorkStatusEnum.POCO_ACCEPT : WorkStatusEnum.POCO_REJECT;
		m_revealCounter = m_revealCounter.add(1);

		Reveal(msg.sender, _result, contribution.status); // TODO add WorkStatusEnum in LOG
		return true;
	}

	// if sheduler never call finalized ? no incetive to do that. schedulermust be pay also at this time
	function finalizedTask( string _stdout, string _stderr, string _uri) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		require(m_status == ConsensusStatusEnum.REACHED);

		require(m_revealDate <= now || m_revealCounter == m_tasksWorkers.length);
		m_status = ConsensusStatusEnum.FINALIZED;

		// add penalized to the call worker to contrubution and they never contribute ?
		require(rewardTask());

		require(iexecHubInterface.finalizedTask(m_taskID, _stdout, _stderr, _uri, m_schedulerReward));
		return true;
	}

	function rewardTask() internal returns (bool)
	{
		uint256 i;
		address w;
		/**
		 * Reward distribution:
		 * totalReward is to be distributed amoung the winners relative to their
		 * contribution. I believe that the weight should be someting like:
		 *
		 * w ~= 1+log(score.max256(1))
		 *
		 * But how to handle log in solidity ? Is it worth the gaz ?
		 * → https://ethereum.stackexchange.com/questions/8086/logarithm-math-operation-in-solidity#8110
		 *
		 * Current code shows a simple distribution (equal shares)
		 */
		uint256 cntWinners  = 0;
		uint256 totalReward = m_workersReward;
		uint256 individualReward;
		for (i = 0; i<m_tasksWorkers.length; ++i)
		{
			w = m_tasksWorkers[i];
			if (m_tasksContributions[w].status == WorkStatusEnum.POCO_ACCEPT)
			{
				cntWinners = cntWinners.add(1);
			}
			else // WorkStatusEnum.POCO_REJECT or WorkStatusEnum.SUBMITTED (not revealed)
			{
				totalReward = totalReward.add(m_stakeAmount);
			}
		}
		require(cntWinners > 0);

		individualReward = totalReward.div(cntWinners);
		for (i = 0; i<m_tasksWorkers.length; ++i)
		{
			w = m_tasksWorkers[i];
			if (m_tasksContributions[w].status == WorkStatusEnum.POCO_ACCEPT)
			{
				require(iexecHubInterface.unlockForTask(m_taskID, w, m_stakeAmount)); // should failed if no locked ?
				require(iexecHubInterface.rewardForTask(m_taskID, w, individualReward));
			}
			else // WorkStatusEnum.POCO_REJECT or WorkStatusEnum.SUBMITTED (not revealed)
			{
				require(iexecHubInterface.seizeForTask(m_taskID, w, m_stakeAmount));
				// No Reward
			}
		}
		return true;
	}


}
