pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import './IexecHub.sol';
import "./TaskRequest.sol";
import "./SafeMathOZ.sol";
import "./AuthorizedList.sol";

contract WorkerPool is OwnableOZ, IexecHubAccessor//Owned by a S(w)
{
	using SafeMathOZ for uint256;

	uint256 public constant REVEAL_PERIOD_DURATION = 3 hours;

	enum WorkerPoolStatusEnum { OPEN, CLOSE }

	enum TaskStatusEnum
	{
		UNSET,
		PENDING,
		CANCELLED, // Not accepted → cancelled
		ACCEPTED,
		CONSENSUS_REACHED,
		/**
		 * CONSENSUS_FAILLED:
		 * After sometime, if the consensus is not reach, anyone with stake in
		 * it can abort the consensus and unlock all stake
		 */
		CONSENSUS_FAILLED,
		FINALIZED
	}

	struct Task
	{
		address        taskID;
		TaskStatusEnum status;
		uint256        stake;
		string         stdout;
		string         stderr;
		string         uri;
		bytes32        consensus;
		uint256        revealDate;
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
		/* bool    asked; */
		/* bool    submitted; */
		/* bool    poco; */
		WorkStatusEnum status;
		bytes32        resultHash;
		bytes32        resultSign; // change from salt to tx.origin based signature
		int256         balance;
	}

	/**
	 * Members
	 */
	string                                       public m_name;
	uint256                                      public m_stakePolicyRatio;
	WorkerPoolStatusEnum                         public m_workerPoolStatus;
	address[]                                    public m_workers;
	// mapping(address=> index)
	mapping(address => uint256)                  public m_workerIndex;
	// mapping(taskID => Task);
	mapping(address => Task)                     public m_tasks;
	// mapping(taskID => worker address => Work);
	mapping(address => mapping(address => Work)) public m_tasksContributions;
	// mapping(taskID => worker address)
	mapping(address => address[])                public m_tasksWorkers;

	/**
	 * Events
	 */
	event CallForWork(address taskID, address indexed worker);

	/**
	 * Address of slave contracts
	 */
	address public m_workersAuthorizedListAddress;

	/**
	 * Methods
	 */

	//constructor
	function WorkerPool(
		address _iexecHubAddress,
		string  _name)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender == DatasetHub
		require(tx.origin != msg.sender );
		transferOwnership(tx.origin); // owner → tx.origin

		m_name             = _name;
		m_stakePolicyRatio = 30; // % of the task price to stake → cf function SubmitTask
		m_workerPoolStatus = WorkerPoolStatusEnum.OPEN;


		/* cannot do the following AuthorizedList contracts creation because of :
		   VM Exception while processing transaction: out of gas at deploy.
		   use attach....AuthorizedListContract instead function
		*/
   /*
	  workersAuthorizedListAddress = new AuthorizedList();
	  AuthorizedList(workersAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin
		dappsAuthorizedListAddress = new AuthorizedList();
		AuthorizedList(dappsAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin
		requesterAuthorizedListAddress = new AuthorizedList();
		AuthorizedList(requesterAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin
		*/
	}

	function changeStakePolicyRatio(uint256 _newstakePolicyRatio) public onlyOwner
	{
		m_stakePolicyRatio = _newstakePolicyRatio;
		//TODO LOG
	}

	function getWorkerPoolOwner() public view returns (address)
	{
		return m_owner;
	}

	/************************* worker list management **************************/
	function isWorkerAllowed(address _worker) public returns (bool)
	{
		return AuthorizedList(m_workersAuthorizedListAddress).isActorAllowed(_worker);
	}
	function isWorkerRegistered(address _worker) public returns (bool)
	{
		/* return getWorkerIndex(_worker) != 0; //TODO to test → DOES NOT WORK FOR worker 0 */
		uint index = m_workerIndex[_worker];
		return m_workers[index] == _worker;
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
	function addWorker(address _worker) public onlyOwner returns (bool)
	{
		uint index = m_workers.push(_worker);
		m_workerIndex[_worker] = index;

		//LOG TODO
		return true;
	}
	function removeWorker(address _worker) public onlyOwner returns (bool)
	{
		uint index = getWorkerIndex(_worker); // fails if worker not registered
		m_workers[index] = m_workers[m_workers.length-1];
		delete m_workers[m_workers.length-1];
		m_workers.length--;

		//LOG TODO
		return true;
	}

	/************************* open / close mechanisms *************************/
	function open() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(m_workerPoolStatus == WorkerPoolStatusEnum.CLOSE);
		m_workerPoolStatus = WorkerPoolStatusEnum.OPEN;
		return true;
	}
	function close() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(m_workerPoolStatus == WorkerPoolStatusEnum.OPEN);
		m_workerPoolStatus = WorkerPoolStatusEnum.CLOSE;
		return true;
	}
	function isOpen() public view returns (bool)
	{
		return m_workerPoolStatus == WorkerPoolStatusEnum.OPEN;
	}

	/**************************** tasks management *****************************/
	function submitedTask(address _taskID) public onlyIexecHub returns (bool)
	{
		//check and reject idempotence on _taskID
		require(m_tasks[_taskID].status == TaskStatusEnum.UNSET);

		//TODO add a shceduler tax on the reward allocted for worker. for his owned reward
		TaskRequest aTaskRequest = TaskRequest(_taskID);

		m_tasks[_taskID].status    = TaskStatusEnum.PENDING;
		m_tasks[_taskID].taskID    = _taskID;
		m_tasks[_taskID].stake     = aTaskRequest.m_taskCost().mul(m_stakePolicyRatio).div(100);
		//TODO check accept this dapp in weight list
		//TODO check accept this user in weight list
		return true;
	}

	function acceptTask(address _taskID) public onlyOwner /*=onlySheduler*/  returns (bool)
	{
		// msg.sender == scheduler ==o wner
		require(m_tasks[_taskID].status == TaskStatusEnum.PENDING);
		m_tasks[_taskID].status    = TaskStatusEnum.ACCEPTED;
		require(iexecHubInterface.lockForTask(_taskID, msg.sender, m_tasks[_taskID].stake));


		//TODO LOG TaskAccepted
		return true;
	}


	function cancelTask(address _taskID) public onlyIexecHub returns (bool)
	{

		// only on pending task.
		// The workerPool do not want to treat this under priced task, so has never ACCEPTED this task.
		// Think like orderbook but here it is a taskbook. The user remove his order.
		// The user in this case can call this function for the user have RLC back in his pocker;

		require(m_tasks[_taskID].status == TaskStatusEnum.PENDING);
		m_tasks[_taskID].status    = TaskStatusEnum.CANCELLED;
		//TODO LOG cancelTask
		return true;
	}

	function claimFailedConsensus() public // TODO
	{
		//TODO
	}

	function callForContribution(address _taskID, address _worker) public onlyOwner /*=onlySheduler*/ returns (bool)
	{
		require(m_tasks[_taskID].status == TaskStatusEnum.ACCEPTED);

		// random worker selection ? :
		// Can use a random selection trick by using block.blockhash (256 most recent blocks accessible) and a modulo list of workers not yet called.

		require(isWorkerRegistered(_worker));
		require(m_tasksContributions[_taskID][_worker].status == WorkStatusEnum.UNSET );
		m_tasksContributions[_taskID][_worker].status = WorkStatusEnum.REQUESTED;
		CallForWork(_taskID, _worker);
		return true;
	}

	function contribute(address _taskID, bytes32 _resultHash, bytes32 _resultSign) public
	{
		// msg.sender = a worker
		require(m_tasks[_taskID].status == TaskStatusEnum.ACCEPTED);
		require(m_tasksContributions[_taskID][msg.sender].status == WorkStatusEnum.REQUESTED);
		require(_resultHash != 0x0);
		require(_resultSign != 0x0);

		m_tasksWorkers[_taskID].push(msg.sender);
		m_tasksContributions[_taskID][msg.sender].status     = WorkStatusEnum.SUBMITTED;
		m_tasksContributions[_taskID][msg.sender].resultHash = _resultHash;
		m_tasksContributions[_taskID][msg.sender].resultSign = _resultSign;
		require(iexecHubInterface.lockForTask(_taskID, msg.sender, m_tasks[_taskID].stake));

	}

	function revealConsensus(address _taskID, bytes32 _consensus) public onlyOwner /*=onlySheduler*/
	{
		require(m_tasks[_taskID].status == TaskStatusEnum.ACCEPTED); //or state Locked to add ?
		m_tasks[_taskID].status     = TaskStatusEnum.CONSENSUS_REACHED;
		m_tasks[_taskID].consensus  = _consensus;
		m_tasks[_taskID].revealDate = REVEAL_PERIOD_DURATION.add(now); //TODO add safe math → put inside task ?
		// TODO LOG
	}

	function reveal(address _taskID, bytes32 _result) public
	{
		// msg.sender = a worker
		require(m_tasks[_taskID].status == TaskStatusEnum.CONSENSUS_REACHED);
		require(m_tasks[_taskID].revealDate > now);
		require(m_tasksContributions[_taskID][msg.sender].status == WorkStatusEnum.SUBMITTED);
		require(_result != 0x0);

		//TODO write correct check of concat _result + _salt not add of int
		bool valid = keccak256(_result                        ) == m_tasksContributions[_taskID][msg.sender].resultHash             // sha256 → keccak256
		          && keccak256(_result ^ keccak256(msg.sender)) == m_tasksContributions[_taskID][msg.sender].resultSign; // ^ → xor // sha256 → keccak256

		m_tasksContributions[_taskID][msg.sender].status = valid ? WorkStatusEnum.POCO_ACCEPT : WorkStatusEnum.POCO_REJECT;
		//TODO LOG  reveal step
	}

	// if sheduler never call finalized ? no incetive to do that. schedulermust be pay also at this time
	function finalizedTask(address _taskID, string _stdout, string _stderr, string _uri) public onlyOwner /*=onlySheduler*/ returns (bool)
	{
		require(m_tasks[_taskID].status == TaskStatusEnum.CONSENSUS_REACHED);
		//TODO add all workers have reveal so we do not have to wait until the end of REVEAL_PERIOD_DURATION
		require(m_tasks[_taskID].revealDate <= now);
		m_tasks[_taskID].status    = TaskStatusEnum.FINALIZED;
		m_tasks[_taskID].stdout    = _stdout;
		m_tasks[_taskID].stderr    = _stderr;
		m_tasks[_taskID].uri       = _uri;


		TaskRequest aTaskRequest = TaskRequest(_taskID);
		if (aTaskRequest.m_dappCallback())
		{
			require(aTaskRequest.taskRequestCallback(_taskID,_stdout,_stderr,_uri));
		}

		// call this for reward dappProvider if dappPrice > 0
		require(iexecHubInterface.finalizedTask(_taskID));

		//extrenalize part of the reward logic into a upgradable contract owned by scheduler ?
		// add penalized to the call worker to contrubution and they never contribute ?
		require(rewardTask(_taskID));

		return true;
	}

	function rewardTask(address _taskID) internal returns (bool)
	{
		TaskRequest aTaskRequest = TaskRequest(_taskID);
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
		uint256 totalReward      = aTaskRequest.m_taskCost();
		uint256 individualReward;
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].status == WorkStatusEnum.POCO_ACCEPT)
			{
				cntWinners = cntWinners.add(1);
			}
			else // WorkStatusEnum.POCO_REJECT
			{
				totalReward = totalReward.add(m_tasks[_taskID].stake);
			}
		}
		require(cntWinners > 0);
		individualReward = totalReward.div(cntWinners);
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].status == WorkStatusEnum.POCO_ACCEPT)
			{
				require(iexecHubInterface.unlockForTask(_taskID,w, m_tasks[_taskID].stake));
				require(iexecHubInterface.rewardForTask(_taskID,w, individualReward));
				require(iexecHubInterface.scoreWinForTask(_taskID,w, 1));
				m_tasksContributions[_taskID][w].balance = int256(individualReward);
			}
			else // WorkStatusEnum.POCO_REJECT
			{
				require(iexecHubInterface.seizeForTask(_taskID,w, m_tasks[_taskID].stake));
				// No Reward
				require(iexecHubInterface.scoreLoseForTask(_taskID,w, 50));
				m_tasksContributions[_taskID][w].balance = -int256(m_tasks[_taskID].stake); // TODO: SafeMath
			}
		}

		/**
		 * Futur: requires a "log" function
		 */
		/*
		uint                     totalReward       = m_tasks[_taskID].reward;
		uint                     distributedReward = 0;
		uint                     totalWeight       = 0;
		mapping(address => uint) workerWeight;
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].resultHash == _consensus)
			{
				uint weight     = 1+log(max256(1, score(w)));
				workerWeight[w] = weight;
				totalWeight    += weight;
			}
			else
			{
				totalReward += m_tasks[_taskID].stake; // TODO: SafeMath
			}
		}
		require(totalWeight > 0);
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].poco)
			{
				uint individualReward = totalReward * workerWeight[w] / totalWeight;
				distributedReward += individualReward;
				require(iexecHub.unlockForTask(w, m_tasks[_taskID].stake));
				require(iexecHub.rewardForTask(w, individualReward));
				require(iexecHub.scoreWinForTask(w, 1));
				m_tasksContributions[_taskID][w].balance = int256(individualReward);
			}
			else
			{
				require(iexecHub.seizeForTask(_taskID,w, m_tasks[_taskID].stake));
				// No Reward
				require(iexecHub.scoreLoseForTask(_taskID,w, 50));
				m_tasksContributions[_taskID][w].balance = -int256(m_tasks[_taskID].stake); // TODO: SafeMath
			}
		}
		// TODO: What to do with the rest (totalReward - distributedReward) → To the scheduler ?
		*/
		return true;
	}



}
