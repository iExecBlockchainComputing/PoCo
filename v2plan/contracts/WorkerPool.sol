pragma solidity ^0.4.18;

import "./Poco.sol";
import "./DappAPI.sol";
import "./interfaces/IWorkerPool.sol";
import "rlc-token/contracts/Ownable.sol";
import "rlc-token/contracts/Ownable.sol";



contract WorkerPool is IWorkerPool, Ownable //Owned by a S(w)
{
	string         name;
	uint           stakePolicyRatio;
	address[]      workers;
	address        poco;

	enum PoolStatusEnum{OPEN,CLOSE}
	PoolStatusEnum poolStatus;

	uint public constant REVEAL_PERIOD_DURATION =  3 hours;

	modifier onlyPoco()
	{
		if (msg.sender == poco) // TODO: require instead of if ?
			_;
	}

	//constructor
	function WorkerPool(address _poco,string _name) public
	{
		poco             = _poco;
		name             = _name;
		stakePolicyRatio = 1;// TODO to  set 0.3 better value by default. sheduler can tun it after
		poolStatus       = PoolStatusEnum.OPEN;
	}

	// mapping(address=> index)
	mapping(address=> uint256) public workerIndex;

	/**
	 * WHITELIST AND BLACKLIST WORKER POLICY
	 */
	enum WorkersPolicyEnum { WHITELIST, BLACKLIST }
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

	/**
	 * WHITELIST AND BLACKLIST DAPP POLICY
	 */
	enum DappsPolicyEnum { WHITELIST, BLACKLIST }
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
		bytes32        taskID;
		uint256        timestamp;
		TaskStatusEnum status;
		address        user;
		address        dapp;
		address        workerPool;
		bool           dappCallback;
		string         taskParam;
		uint           trust;
		uint           reward;
		uint           stake;
		string         stdout;
		string         stderr;
		string         uri;
		uint256        consensus;
	}
	//mapping (taskID => Task) m_tasks;
	mapping (bytes32 => Task) m_tasks;

	struct Work
	{
		bool    asked;
		bool    submitted;
		bool    poco;
		uint256 resultHash;
		//uint256 saltHash; // unused
		uint256 resultSaltedHash;
		int256  balance;
	}

	//mapping (taskID => worker address => Work) m_tasksContributions;
	mapping (bytes32 => mapping (address => Work)) m_tasksContributions;

	//mapping (taskID => worker address )
	mapping(bytes32 => address[]) public m_tasksWorkers;

	mapping(bytes32 => uint256) public m_tasksContributionsRevealDeadLine;

	event CallForWork(bytes32 taskID, address indexed worker);

	function isWorkerRegistered( address _worker) public returns (bool)
	{
		return getWorkerIndex(_worker) != 0; //TODO to test
	}
	function changeStakePolicyRatio(uint newstakePolicyRatio) public onlyOwner
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
		//LOG TODO
		return true;
	}
	function openPool() public onlyPoco /*for staking management*/ returns (bool)
	{
		require(poolStatus == PoolStatusEnum.CLOSE);
		poolStatus = PoolStatusEnum.OPEN;
		return true;
	}
	function closePool() public onlyPoco /*for staking management*/ returns (bool)
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
		bytes32 _taskID,
		address dapp,
		string  taskParam,
		uint    reward,
		uint    trust,
		bool    dappCallback
	) public onlyPoco returns (bool)
	{
		// msg.sender = dapp
		//check and reject idempotence on _taskID
		require(m_tasks[_taskID].status == TaskStatusEnum.UNSET);
		m_tasks[_taskID].status       = TaskStatusEnum.PENDING;
		m_tasks[_taskID].taskID       = _taskID;
		m_tasks[_taskID].user         = tx.origin;
		m_tasks[_taskID].dapp         = dapp;
		m_tasks[_taskID].taskParam    = taskParam;
		m_tasks[_taskID].trust        = trust;
		m_tasks[_taskID].workerPool   = this;
		//TODO add a shceduler tax on the reward allocted for worker. for his owned reward
		m_tasks[_taskID].reward       = reward;
		m_tasks[_taskID].stake        = reward*stakePolicyRatio; //TODO safemath
		m_tasks[_taskID].dappCallback = dappCallback;
		m_tasks[_taskID].timestamp    = now;
		//TODO check accept this dapp in weight list
		//TODO check accept this user in weight list
		return true;
	}

	function acceptTask(bytes32 _taskID) public onlyOwner /*=onlySheduler*/  returns (bool)
	{
		// TODO CALL lock and stake for scheduler ?
		require(m_tasks[_taskID].status == TaskStatusEnum.PENDING);
		require(m_tasks[_taskID].workerPool == msg.sender);
		m_tasks[_taskID].status    = TaskStatusEnum.ACCEPTED;
		m_tasks[_taskID].timestamp = now;
		//TODO LOG TaskAccepted
		return true;
	}

	function claimAcceptedTask () public
	{
		//TODO
		// ACCEPTED tasked never completed for a long long time by the workerPool.
		//see "loose of stake" in IPoco.sol 1)
	}
	// in this case, the lock fund of the scheduler will go to the user.

	function cancelTask () public // onlyPoco ?
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

	function callForContribution(bytes32 _taskID, address worker ) public onlyOwner /*=onlySheduler*/ returns (bool)
	{
		require(m_tasks[_taskID].status == TaskStatusEnum.ACCEPTED);

		// random worker selection ? :
		// Can use a random selection trick by using block.blockhash (256 most recent blocks accessible) and a modulo list of workers not yet called.

		require(isWorkerRegistered(worker));
		require(! m_tasksContributions[_taskID][worker].submitted );
		require(! m_tasksContributions[_taskID][worker].asked );
		require(isWorkerRegistered(worker)); //TODO: Duplicate ?
		m_tasksContributions[_taskID][worker].asked  = true;
		CallForWork(_taskID,worker);
		return true;
	}

	function contribute(bytes32 _taskID, uint256 _resultHash, uint256 _resultSaltedHash) public
	{
		// msg.sender = a worker
		require(m_tasks[_taskID].status == TaskStatusEnum.ACCEPTED);
		require(m_tasksContributions[_taskID][msg.sender].asked);
		require(!m_tasksContributions[_taskID][msg.sender].submitted);
		require(_resultHash       != 0x0);
		require(_resultSaltedHash != 0x0);

		m_tasksWorkers[_taskID].push(msg.sender);
		m_tasksContributions[_taskID][msg.sender].submitted        = true;
		m_tasksContributions[_taskID][msg.sender].resultHash       = _resultHash;
		m_tasksContributions[_taskID][msg.sender].resultSaltedHash = _resultSaltedHash;
		Poco aPoco = Poco(poco);
		require(aPoco.lockForTask(_taskID, msg.sender, m_tasks[_taskID].stake));
	}

	function revealConsensus(bytes32 _taskID, uint256 consensus) public onlyOwner /*=onlySheduler*/
	{
		require(m_tasks[_taskID].status == TaskStatusEnum.ACCEPTED); //or state Locked to add ?
		m_tasks[_taskID].status    = TaskStatusEnum.CONSENSUS_REACHED;
		m_tasks[_taskID].consensus = consensus;
		m_tasksContributionsRevealDeadLine[_taskID] = now + REVEAL_PERIOD_DURATION; //TODO add safe math
		// TODO LOG
	}

	function reveal(bytes32 _taskID, uint256 _result, uint256 _salt ) public
	{
		// msg.sender = a worker
		require(m_tasks[_taskID].status == TaskStatusEnum.CONSENSUS_REACHED);
		require(m_tasksContributionsRevealDeadLine[_taskID] != 0x0 && now < m_tasksContributionsRevealDeadLine[_taskID]);
		require(m_tasksContributions[_taskID][msg.sender].submitted);
		require(_salt   != 0x0);
		require(_result != 0x0);
		//TODO write correct check of concat _result + _salt not add of int
		if(
			sha256(_result        ) == bytes32(m_tasksContributions[_taskID][msg.sender].resultHash      ) &&
			sha256(_result ^ _salt) == bytes32(m_tasksContributions[_taskID][msg.sender].resultSaltedHash) // ^ → xor
		)
		{
			//proof of contribution for this worker
			m_tasksContributions[_taskID][msg.sender].poco = true;
		}
		//TODO LOG  reveal step
	}

	// if sheduler never call finalized ? no incetive to do that. schedulermust be pay also at this time
	function finalizedTask(bytes32 _taskID, string stdout, string stderr, string uri) public onlyOwner /*=onlySheduler*/ returns (bool)
	{
		require(m_tasks[_taskID].status == TaskStatusEnum.CONSENSUS_REACHED);
		require(m_tasksContributionsRevealDeadLine[_taskID] != 0x0 && now >= m_tasksContributionsRevealDeadLine[_taskID]);
		m_tasks[_taskID].status    = TaskStatusEnum.FINALIZED;
		m_tasks[_taskID].stdout    = stdout;
		m_tasks[_taskID].stderr    = stderr;
		m_tasks[_taskID].uri       = uri;
		m_tasks[_taskID].timestamp = now;

		// option of call back to dapp smart contract asked by user
		if(m_tasks[_taskID].dappCallback)
		{
			iexecSubmitCallback(_taskID,m_tasks[_taskID].dapp,m_tasks[_taskID].user,stdout,uri);
			// if callback do not work. take the stake of dapp provider ?
		}

		// call this for reward dappProvider if dappPrice > 0
		Poco aPoco = Poco(poco);
		require(aPoco.finalizedTask(_taskID,m_tasks[_taskID].dapp));

		//extrenalize part of the reward logic into a upgradable contract owned by scheduler ?
		// add penalized to the call worker to contrubution and they never contribute ?
		require(rewardTask(_taskID));

		return true;
	}

	function rewardTask(bytes32 _taskID) internal returns (bool)
	{
		Poco aPoco = Poco(poco);
		uint    i;
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
		uint    cntWinners       = 0;
		uint    totalReward      = m_tasks[_taskID].reward;
		uint    individualReward;
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].poco)
			{
				++cntWinners; // TODO: SafeMath
			}
			else
			{
				totalReward += m_tasks[_taskID].stake; // TODO: SafeMath
			}
		}
		require(cntWinners > 0);
		individualReward = totalReward / cntWinners; // TODO: SafeMath
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].poco)
			{
				require(aPoco.unlockForTask(_taskID,w, m_tasks[_taskID].stake));
				require(aPoco.rewardForTask(_taskID,w, individualReward));
				require(aPoco.scoreWinForTask(_taskID,w, 1));
				m_tasksContributions[_taskID][w].balance = int256(individualReward);
			}
			else
			{
				require(aPoco.seizeForTask(_taskID,w, m_tasks[_taskID].stake));
				// No Reward
				require(aPoco.scoreWinForTask(_taskID,w, 50));
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
			if (m_tasksContributions[_taskID][w].resultHash == _consensus)
			{
				uint individualReward = totalReward * workerWeight[w] / totalWeight;
				distributedReward += individualReward;
				unlock(w, m_tasks[_taskID].stake);
				reward(w, individualReward);
				scoreWin(w, 1);
				m_tasksContributions[_taskID][w].balance = int256(individualReward);
			}
			else
			{
				seize(w, m_tasks[_taskID].stake);
				// No Reward
				scoreLose(w, 50);
				m_tasksContributions[_taskID][w].balance = -int256(m_tasks[_taskID].stake); // TODO: SafeMath
			}
		}
		// TODO: What to do with the rest (totalReward - distributedReward) → To the scheduler ?
		*/
		return true;
	}

	function iexecSubmitCallback(bytes32 _taskID, address dapp, address user, string stdout, string uri) internal
	{
		DappAPI aDappAPI = DappAPI(dapp);
		require(aDappAPI.iexecSubmitCallback(_taskID,user,stdout,uri));
	}

}
