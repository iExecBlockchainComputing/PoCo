pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubInterface.sol';

import "./TaskRequest.sol";
import "./SafeMathOZ.sol";

contract WorkerPool is OwnableOZ, IexecHubInterface//Owned by a S(w)
{

	using SafeMathOZ for uint256;

	enum PoolStatusEnum{OPEN,CLOSE}

	string   public  name;
	uint256          stakePolicyRatio;
	PoolStatusEnum   poolStatus;
	address[]        workers;

	uint256 public constant REVEAL_PERIOD_DURATION =  3 hours;

	//constructor
	function WorkerPool(
		address _iexecHubAddress,
		string _name)
	IexecHubInterface(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender == DatasetHub
		require(tx.origin != msg.sender );
		transferOwnership(tx.origin); // owner → tx.origin

		name             = _name;
		stakePolicyRatio = 1;// TODO to  set 0.3 better value by default. sheduler can tun it after
		poolStatus       = PoolStatusEnum.OPEN;
	}

	// mapping(address=> index)
	mapping(address=> uint256) public workerIndex;

	/**
	 * WHITELIST AND BLACKLIST WORKER POLICY
	 */
	/*enum WorkersPolicyEnum { WHITELIST, BLACKLIST }
	WorkersPolicyEnum public workersPolicy = WorkersPolicyEnum.WHITELIST;
	event WorkersPolicyChange(WorkersPolicyEnum oldPolicy,WorkersPolicyEnum newPolicy);

	function changeWorkerListPolicy(WorkersPolicyEnum _workersPolicyEnum) public onlyOwner
	{
		WorkersPolicyChange(workersPolicy,_workersPolicyEnum);
		workersPolicy = _workersPolicyEnum;
		//TODO LOG
	}

	mapping(address => bool) whitelistWorker;
	mapping(address => bool) blacklistWorker;
	event WhitelistWorkerChange(address worker,bool isWhitelisted);
	event BlacklistWorkerChange(address worker,bool isBlacklisted);

	modifier checkWhitelistWorker(address _worker)
	{
		require(workersPolicy == WorkersPolicyEnum.BLACKLIST || whitelistWorker[_worker] == true);
		_;
	}
	modifier checkBlacklistWorker(address _worker)
	{
		require(workersPolicy == WorkersPolicyEnum.WHITELIST || blacklistWorker[_worker] == false);
		_;
	}
	function updateWhitelistWorker(address _worker, bool _isWhitelisted) public onlyOwner
	{
		whitelistWorker[_worker] = _isWhitelisted;
		WhitelistWorkerChange(_worker, _isWhitelisted);
	}
	function updateBlacklistWorker(address _worker, bool _isBlacklisted) public onlyOwner
	{
			blacklistWorker[_worker] = _isBlacklisted;
			BlacklistWorkerChange(_worker, _isBlacklisted);
	}
	function updateWhitelistWorkers(address[] _workers, bool _isWhitelisted) public onlyOwner
	{
		for (uint i = 0; i < _workers.length; ++i)
		{
			updateWhitelistWorker(_workers[i], _isWhitelisted);
		}
	}
	function updateBlacklistWorkers(address[] _workers, bool _isBlacklisted) public onlyOwner
	{
		for (uint i = 0; i < _workers.length; ++i)
		{
			updateBlacklistWorker(_workers[i], _isBlacklisted);
		}
	}
	function isWorkerWhitelisted(address _worker) public returns (bool)
	{
		return whitelistWorker[_worker];
	}
	function isWorkerblacklisted(address _worker) public returns (bool)
	{
		return blacklistWorker[_worker];
	}
	function isWorkerAllowed(address _worker) public returns (bool)
	{
		if(workersPolicy == WorkersPolicyEnum.WHITELIST)
		{
			return isWorkerWhitelisted(_worker);
		}
		else
		{
			return !isWorkerblacklisted(_worker);
		}
	}
*/
	/**
	 * WHITELIST AND BLACKLIST DAPP POLICY
	 */
	/*enum DappsPolicyEnum { WHITELIST, BLACKLIST }
	DappsPolicyEnum public dappsPolicy = DappsPolicyEnum.WHITELIST;
	event DappsPolicyChange(DappsPolicyEnum oldPolicy,DappsPolicyEnum newPolicy);

	function changeDappListPolicy(DappsPolicyEnum _dappsPolicyEnum) public onlyOwner
	{
		DappsPolicyChange(dappsPolicy,_dappsPolicyEnum);
		dappsPolicy = _dappsPolicyEnum;
		//TODO LOG
	}

	mapping(address => bool) whitelistDapp;
	mapping(address => bool) blacklistDapp;
	event WhitelistDappChange(address dapp,bool isWhitelisted);
	event BlacklistDappChange(address dapp,bool isBlacklisted);

	modifier checkWhitelistDapp(address _dapp)
	{
		require(dappsPolicy ==  DappsPolicyEnum.BLACKLIST || whitelistDapp[_dapp] == true);
		_;
	}
	modifier checkBlacklistDapp(address _dapp)
	{
		require(dappsPolicy == DappsPolicyEnum.WHITELIST || blacklistDapp[_dapp] == false);
		_;
	}
	function updateWhitelistDapp(address _dapp, bool _isWhitelisted) public onlyOwner
	{
		whitelistDapp[_dapp] = _isWhitelisted;
		WhitelistDappChange(_dapp, _isWhitelisted);
	}
	function updateBlacklistDapp(address _dapp, bool _isBlacklisted) public onlyOwner
	{
		blacklistDapp[_dapp] = _isBlacklisted;
		BlacklistDappChange(_dapp, _isBlacklisted);
	}
	function updateWhitelistDapps(address[] _dapps, bool _isWhitelisted) public onlyOwner
	{
		for (uint i = 0; i < _dapps.length; ++i)
		{
			updateWhitelistDapp(_dapps[i], _isWhitelisted);
		}
	}
	function updateBlacklistDapps(address[] _dapps, bool _isBlacklisted) public onlyOwner
	{
		for (uint i = 0; i < _dapps.length; ++i)
		{
			updateBlacklistDapp(_dapps[i], _isBlacklisted);
		}
	}
	function isDappWhitelisted(address _dapp) public returns (bool)
	{
		return whitelistDapp[_dapp];
	}
	function isDappblacklisted(address _dapp) public returns (bool)
	{
		return blacklistDapp[_dapp];
	}
	*/
	/**
	 * WHITELIST AND BLACKLIST USER POLICY
	 */

	//TODO

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
		uint256        timestamp;
		TaskStatusEnum status;
		uint256        stake;
		string         stdout;
		string         stderr;
		string         uri;
		bytes32        consensus;
	}
	//mapping (taskID => Task) m_tasks;
	mapping (address => Task) m_tasks;

	struct Work
	{
		bool    asked;
		bool    submitted;
		bool    poco;
		bytes32 resultHash;
		bytes32 resultSign; // change from salt to tx.origin based signature
		int256  balance;
	}

	//mapping (taskID => worker address => Work) m_tasksContributions;
	mapping (address => mapping (address => Work)) m_tasksContributions;

	//mapping (taskID => worker address )
	mapping(address => address[]) public m_tasksWorkers;

	mapping(address => uint256) public m_tasksContributionsRevealDeadLine;

	event CallForWork(address taskID, address indexed worker);

	function isWorkerRegistered( address _worker) public returns (bool)
	{
		return getWorkerIndex(_worker) != 0; //TODO to test
	}
	function changeStakePolicyRatio(uint256 newstakePolicyRatio) public onlyOwner
	{
		stakePolicyRatio = newstakePolicyRatio;
		//TODO LOG
	}
	function getWorkersCount() constant public returns (uint)
	{
	 return workers.length;
	}
	function getWorkerAddress(uint _index) constant public returns (address)
	{
		return workers[_index];
	}
	function getWorkerIndex( address worker) constant public returns (uint)
	{
		return workerIndex[worker];
	}
	function getWorkerPoolOwner() public view returns (address)
	{
		return owner;
	}
	function addWorker(address worker) public onlyOwner returns (bool)
	{
		workers.push(worker);
		//LOG TODO
		return true;
	}
	function removeWorker(address worker) public onlyOwner returns (bool)
	{
		uint index = getWorkerIndex(worker);
		/**
		 * THIS IS BAD, GAS COST IS TERRIBLE.
		 */
		/*
		//TODO test this. index 0 or 1?
		require (index > 0); //Hadrien: pourquoi ? Si on veux supprimer l'index 0 ca devrai etre possible (et le code marche)
		require (index < workers.length);
		// size limit of worker on pool ?. worker pool will be stuck if we cannot remove because of out of gas
		for (uint i = index; i<workers.length-1; ++i)
		{
			workers[i] = workers[i+1];
		}
		delete workers[workers.length-1];
		workers.length--;
		*/

		/**
		 * Good solution: we don't need to keep the worker in order.
		 */
		workers[index] = workers[workers.length-1];
		delete workers[workers.length-1];
		workers.length--;

		//LOG TODO
		return true;
	}
	function openPool() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(poolStatus == PoolStatusEnum.CLOSE);
		poolStatus = PoolStatusEnum.OPEN;
		return true;
	}
	function closePool() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(poolStatus == PoolStatusEnum.OPEN);
		poolStatus = PoolStatusEnum.CLOSE;
		return true;
	}
	function isOpen() public returns (bool)
	{
		return poolStatus == PoolStatusEnum.OPEN;
	}
	function isClose() public returns (bool)
	{
		return poolStatus == PoolStatusEnum.CLOSE;
	}
	function submitedTask(
		address _taskID
	) public onlyIexecHub returns (bool)
	{
		//check and reject idempotence on _taskID
		require(m_tasks[_taskID].status == TaskStatusEnum.UNSET);
		m_tasks[_taskID].status       = TaskStatusEnum.PENDING;
		m_tasks[_taskID].taskID       = _taskID;
		//TODO add a shceduler tax on the reward allocted for worker. for his owned reward
		TaskRequest aTaskRequest =TaskRequest(_taskID);
		m_tasks[_taskID].stake        = aTaskRequest.taskCost()*stakePolicyRatio;
		m_tasks[_taskID].timestamp    = now;
		//TODO check accept this dapp in weight list
		//TODO check accept this user in weight list
		return true;
	}

	function acceptTask(address _taskID) public onlyOwner /*=onlySheduler*/  returns (bool)
	{
		// msg.sender == scheduler ==o wner
		require(m_tasks[_taskID].status == TaskStatusEnum.PENDING);
		m_tasks[_taskID].status    = TaskStatusEnum.ACCEPTED;
		m_tasks[_taskID].timestamp = now;
		require(iexecHub.lockForTask(_taskID, msg.sender, m_tasks[_taskID].stake));

		//TODO LOG TaskAccepted
		return true;
	}


	function cancelTask () public // onlyIexecHub ?
	{
		//TODO

		// only on pending task.
		// The workerPool do not want to treat this under priced task, so has never ACCEPTED this task.
		// Think like orderbook by here it is a taskbook. The user remove his order.
		// The user in this case can call this function for the user have RLC back in his pocker;
	}

	function claimFailedConsensus () public // TODO
	{
		//TODO
	}

	function callForContribution(address _taskID, address worker ) public onlyOwner /*=onlySheduler*/ returns (bool)
	{
		require(m_tasks[_taskID].status == TaskStatusEnum.ACCEPTED);

		// random worker selection ? :
		// Can use a random selection trick by using block.blockhash (256 most recent blocks accessible) and a modulo list of workers not yet called.

		require(isWorkerRegistered(worker));
		require(! m_tasksContributions[_taskID][worker].submitted );
		require(! m_tasksContributions[_taskID][worker].asked );
		m_tasksContributions[_taskID][worker].asked  = true;
		CallForWork(_taskID,worker);
		return true;
	}

	function contribute(address _taskID, bytes32 _resultHash, bytes32 _resultSign) public
	{
		// msg.sender = a worker
		require(m_tasks[_taskID].status == TaskStatusEnum.ACCEPTED);
		require(m_tasksContributions[_taskID][msg.sender].asked);
		require(!m_tasksContributions[_taskID][msg.sender].submitted);
		require(_resultHash != 0x0);
		require(_resultSign != 0x0);

		m_tasksWorkers[_taskID].push(msg.sender);
		m_tasksContributions[_taskID][msg.sender].submitted  = true;
		m_tasksContributions[_taskID][msg.sender].resultHash = _resultHash;
		m_tasksContributions[_taskID][msg.sender].resultSign = _resultSign;
		require(iexecHub.lockForTask(_taskID, msg.sender, m_tasks[_taskID].stake));
	}

	function revealConsensus(address _taskID, bytes32 consensus) public onlyOwner /*=onlySheduler*/
	{
		require(m_tasks[_taskID].status == TaskStatusEnum.ACCEPTED); //or state Locked to add ?
		m_tasks[_taskID].status    = TaskStatusEnum.CONSENSUS_REACHED;
		m_tasks[_taskID].consensus = consensus;
		m_tasksContributionsRevealDeadLine[_taskID] = REVEAL_PERIOD_DURATION.add(now); //TODO add safe math
		// TODO LOG
	}

	function reveal(address _taskID, bytes32 _result) public
	{
		// msg.sender = a worker
		require(m_tasks[_taskID].status == TaskStatusEnum.CONSENSUS_REACHED);
		require(m_tasksContributionsRevealDeadLine[_taskID] != 0x0 && now < m_tasksContributionsRevealDeadLine[_taskID]);
		require(m_tasksContributions[_taskID][msg.sender].submitted);
		require(_result != 0x0);
		//TODO write correct check of concat _result + _salt not add of int
		if(
			keccak256(_result                        ) == m_tasksContributions[_taskID][msg.sender].resultHash &&         // sha256 → keccak256
			keccak256(_result ^ keccak256(msg.sender)) == m_tasksContributions[_taskID][msg.sender].resultSign // ^ → xor // sha256 → keccak256
		)
		{
			//proof of contribution for this worker
			m_tasksContributions[_taskID][msg.sender].poco = true;
		}
		//TODO LOG  reveal step
	}

	// if sheduler never call finalized ? no incetive to do that. schedulermust be pay also at this time
	function finalizedTask(address _taskID, string _stdout, string _stderr, string _uri) public onlyOwner /*=onlySheduler*/ returns (bool)
	{
		require(m_tasks[_taskID].status == TaskStatusEnum.CONSENSUS_REACHED);
		//TODO add all workers have reveal so we do not have to wait until the end of REVEAL_PERIOD_DURATION
		require(m_tasksContributionsRevealDeadLine[_taskID] != 0x0 && now >= m_tasksContributionsRevealDeadLine[_taskID]);
		m_tasks[_taskID].status    = TaskStatusEnum.FINALIZED;
		m_tasks[_taskID].stdout    = _stdout;
		m_tasks[_taskID].stderr    = _stderr;
		m_tasks[_taskID].uri       = _uri;
		m_tasks[_taskID].timestamp = now;


		TaskRequest aTaskRequest =TaskRequest(_taskID);
		if(aTaskRequest.dappCallback()){
			require(aTaskRequest.taskRequestCallback(_taskID,_stdout,_stderr,_uri));
		}

		// call this for reward dappProvider if dappPrice > 0
		require(iexecHub.finalizedTask(_taskID));

		//extrenalize part of the reward logic into a upgradable contract owned by scheduler ?
		// add penalized to the call worker to contrubution and they never contribute ?
		require(rewardTask(_taskID));

		return true;
	}

	function rewardTask(address _taskID) internal returns (bool)
	{
		uint256    i;
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
		uint256    cntWinners       = 0;
		TaskRequest aTaskRequest =TaskRequest(_taskID);
		uint256    totalReward      = aTaskRequest.taskCost();
		uint256    individualReward;
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].poco)
			{
				cntWinners = cntWinners.add(1);
			}
			else
			{
				totalReward = totalReward.add(m_tasks[_taskID].stake);
			}
		}
		require(cntWinners > 0);
		individualReward = totalReward.div(cntWinners);
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].poco)
			{
				require(iexecHub.unlockForTask(_taskID,w, m_tasks[_taskID].stake));
				require(iexecHub.rewardForTask(_taskID,w, individualReward));
				require(iexecHub.scoreWinForTask(_taskID,w, 1));
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
