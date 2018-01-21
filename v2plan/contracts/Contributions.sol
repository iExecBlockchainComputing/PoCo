pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import "./SafeMathOZ.sol";
import './IexecHubAccessor.sol';


contract Contributions is OwnableOZ, IexecHubAccessor//Owned by a S(w)
{
	using SafeMathOZ for uint256;

	uint256 public constant REVEAL_PERIOD_DURATION = 3 hours;
	uint256 public constant CONSENSUS_DURATION_LIMIT = 7 days; // 7 days as the MVP here ;) https://ethresear.ch/t/minimal-viable-plasma/426

  address        public m_workerPool;
	address        public m_taskID;
	ConsensusStatusEnum public m_status;
	uint256        public m_taskReward;
	uint256        public m_workerStake;
	uint256        public m_schedulerStake;
	bytes32        public m_consensus;
	uint256        public m_revealDate;
	uint256        public m_revealCounter;
	uint256        public m_consensusTimout;


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

	struct Work
	{
		WorkStatusEnum status;
		bytes32        resultHash;
		bytes32        resultSign; // change from salt to tx.origin based signature
		int256         balance;
	}

	/**
	 * Events
	 */

	event CallForContribution(address indexed worker);
	event Contribute(address indexed worker,bytes32 resultHash);
	event RevealConsensus(bytes32 consensus);
	event Reveal(address indexed worker, bytes32 result);



	/**
	 * Members
	 */

	// mapping( worker address => Work);
	mapping(address => Work) public m_tasksContributions;

	address[]                public m_tasksWorkers;


	/**
	 * Methods
	 */

	//constructor
	function Contributions( address _iexecHubAddress, address _taskID,uint256 _taskReward, uint256 _schedulerStakePolicyRatio,uint256 _workerStakePolicyRatio)
	OwnableOZ()// owner is WorkerPool contract
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		m_taskID=_taskID;
		m_status=ConsensusStatusEnum.IN_PROGRESS;
		m_schedulerStake = _schedulerStakePolicyRatio;
	  m_workerStake =_workerStakePolicyRatio;
		m_workerPool = msg.sender;
		m_taskReward =_taskReward;
		m_consensusTimout = CONSENSUS_DURATION_LIMIT.add(now);
		transferOwnership(tx.origin); // scheduler (tx.origin) become owner at this moment
		// how  this m_schedulerStake  is used for ?
		//require(iexecHubInterface.lockForTask(_taskID, tx.origin, m_schedulerStake));

	}


	function claimFailedConsensus() public onlyIexecHub returns (bool)
	{
		require(m_status == ConsensusStatusEnum.IN_PROGRESS);
		require(now > m_consensusTimout);
		m_status    = ConsensusStatusEnum.FAILLED;
		uint256 i;
		address w;
		for (i=0; i<m_tasksWorkers.length; ++i)
		{
			w = m_tasksWorkers[i];
			if (m_tasksContributions[w].status == WorkStatusEnum.SUBMITTED)
			{
				require(iexecHubInterface.unlockForTask(m_taskID,w, m_workerStake));
			}
		}
		require(iexecHubInterface.lockForTask(m_taskID,m_owner, m_schedulerStake));
		// how  this m_schedulerStake  is used for ?
		return true;
	}

	function callForContribution(address _worker) public onlyOwner /*=onlySheduler*/ returns (bool)
	{
		require(m_status == ConsensusStatusEnum.IN_PROGRESS);

		// random worker selection ? :
		// Can use a random selection trick by using block.blockhash (256 most recent blocks accessible) and a modulo list of workers not yet called.

		require(iexecHubInterface.getWorkerAffectation(_worker) == m_workerPool);
		require(m_tasksContributions[_worker].status == WorkStatusEnum.UNSET );
		m_tasksContributions[_worker].status = WorkStatusEnum.REQUESTED;
		CallForContribution(_worker);
		return true;
	}

	function contribute(bytes32 _resultHash, bytes32 _resultSign) public returns (uint256 workerStake)
	{
		// msg.sender = a worker
		// tx.origin= a worker
		require(m_status == ConsensusStatusEnum.IN_PROGRESS);
		require(m_tasksContributions[msg.sender].status == WorkStatusEnum.REQUESTED);
		require(_resultHash != 0x0);
		require(_resultSign != 0x0);

		m_tasksWorkers.push(msg.sender);
		m_tasksContributions[msg.sender].status     = WorkStatusEnum.SUBMITTED;
		m_tasksContributions[msg.sender].resultHash = _resultHash;
		m_tasksContributions[msg.sender].resultSign = _resultSign;
		// TODO : implement stake
		//require(iexecHubInterface.lockForTask(m_taskID, msg.sender, workerStake));
		Contribute(msg.sender,_resultHash);
		return m_workerStake;
	}

	function revealConsensus(bytes32 _consensus) public onlyOwner /*=onlySheduler*/ returns (bool)
	{
		require(m_status == ConsensusStatusEnum.IN_PROGRESS); //or state Locked to add ?
		require(m_tasksWorkers.length >0);// you cannot revealConsensus if you do not have callForContribution and no worker have contribute
		m_status     = ConsensusStatusEnum.REACHED;
		m_consensus  = _consensus;
		m_revealDate = REVEAL_PERIOD_DURATION.add(now);
		RevealConsensus(_consensus);
		return true;
	}

	function reveal(bytes32 _result) public returns (bool)
	{
		// msg.sender = a workerpool
		// tx.origin  = a worker
		require(m_status == ConsensusStatusEnum.REACHED);
		require(m_revealDate > now);
		require(m_tasksContributions[tx.origin].status == WorkStatusEnum.SUBMITTED);
		require(_result != 0x0);

		//TODO write correct check of concat _result + _salt not add of int
		bool valid = keccak256(_result                        ) == m_tasksContributions[tx.origin].resultHash             // sha256 → keccak256
		          && keccak256(_result ^ keccak256(tx.origin)) == m_tasksContributions[tx.origin].resultSign; // ^ → xor // sha256 → keccak256

		m_tasksContributions[tx.origin].status = valid ? WorkStatusEnum.POCO_ACCEPT : WorkStatusEnum.POCO_REJECT;
		m_revealCounter=m_revealCounter.add(1);
    Reveal(tx.origin,_result);
		return true;
	}

	// if sheduler never call finalized ? no incetive to do that. schedulermust be pay also at this time
	function finalizedTask( string _stdout, string _stderr, string _uri) public onlyOwner /*=onlySheduler*/ returns (bool)
	{
		require(m_status == ConsensusStatusEnum.REACHED);
		//TODO add all workers have reveal so we do not have to wait until the end of REVEAL_PERIOD_DURATION
		require(m_revealDate <= now || m_revealCounter == m_tasksWorkers.length);
		m_status  = ConsensusStatusEnum.FINALIZED;

		//extrenalize part of the reward logic into a upgradable contract owned by scheduler ?
		// add penalized to the call worker to contrubution and they never contribute ?
		require(rewardTask());

		require(iexecHubInterface.finalizedTask(m_taskID,_stdout,_stderr,_uri));
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
		 * w ~= 1+log(max(1,score))
		 *
		 * But how to handle log in solidity ? Is it worth the gaz ?
		 * → https://ethereum.stackexchange.com/questions/8086/logarithm-math-operation-in-solidity#8110
		 *
		 * Current code shows a simple distribution (equal shares)
		 */
		uint256 cntWinners       = 0;
		uint256 totalReward      = m_taskReward;
		uint256 individualReward;
		for (i=0; i<m_tasksWorkers.length; ++i)
		{
			w = m_tasksWorkers[i];
			if (m_tasksContributions[w].status == WorkStatusEnum.POCO_ACCEPT)
			{
				cntWinners = cntWinners.add(1);
			}
			else // WorkStatusEnum.POCO_REJECT
			{
				totalReward = totalReward.add(m_workerStake);
			}
		}
		require(cntWinners > 0);
		individualReward = totalReward.div(cntWinners);
		for (i=0; i<m_tasksWorkers.length; ++i)
		{
			w = m_tasksWorkers[i];
			if (m_tasksContributions[w].status == WorkStatusEnum.POCO_ACCEPT)
			{
				require(iexecHubInterface.unlockForTask(m_taskID,w, m_workerStake));
				require(iexecHubInterface.rewardForTask(m_taskID,w, individualReward));
				require(iexecHubInterface.scoreWinForTask(m_taskID,w, 1));
				m_tasksContributions[w].balance = int256(individualReward);
			}

			else // WorkStatusEnum.POCO_REJECT
			{
				require(iexecHubInterface.seizeForTask(m_taskID,w, m_workerStake));
				// No Reward
				require(iexecHubInterface.scoreLoseForTask(m_taskID,w, 50));
				m_tasksContributions[w].balance = -int256(m_workerStake); // TODO: SafeMath
			}
		}

	  return true;
	}





}
