pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import "./tools/IexecODBLibCore.sol";
import "./tools/IexecODBLibOrders.sol";
import "./tools/EIP1154.sol";
import "./tools/SafeMathOZ.sol";

import "./CategoryManager.sol";

import "./IexecClerk.sol";
import "./registries/RegistryBase.sol";
/* import "./registries/DappRegistry.sol"; */
/* import "./registries/DataRegistry.sol"; */
/* import "./registries/PoolRegistry.sol"; */

contract IexecHub is CategoryManager, Oracle
{
	using SafeMathOZ for uint256;

	/***************************************************************************
	 *                                Constants                                *
	 ***************************************************************************/
	uint256 public constant SCORE_UNITARY_SLASH      = 50;
	uint256 public constant CONSENSUS_DURATION_RATIO = 10;
	uint256 public constant REVEAL_DURATION_RATIO    = 2;

	/***************************************************************************
	 *                             Other contracts                             *
	 ***************************************************************************/
	IexecClerk   public iexecclerk;
	RegistryBase public dappregistry;
	RegistryBase public dataregistry;
	RegistryBase public poolregistry;
	/* DappRegistry dappregistry; */
	/* DataRegistry dataregistry; */
	/* PoolRegistry poolregistry; */

	/***************************************************************************
	 *                          Consensuses & Workers                          *
	 ***************************************************************************/
	mapping(bytes32 =>                    IexecODBLibCore.Task         ) m_tasks;
	mapping(bytes32 => mapping(address => IexecODBLibCore.Contribution)) m_contributions;
	mapping(address =>                    uint256                      ) m_workerScores;
	mapping(address =>                    address                      ) m_workerAffectations;

	/***************************************************************************
	 *                                 Events                                  *
	 ***************************************************************************/
	event TaskInitialize(bytes32 indexed taskid, address indexed pool                     );
	event TaskContribute(bytes32 indexed taskid, address indexed worker, bytes32 hash     );
	event TaskConsensus (bytes32 indexed taskid,                         bytes32 consensus);
	event TaskReveal    (bytes32 indexed taskid, address indexed worker, bytes32 digest   );
	event TaskReopen    (bytes32 indexed taskid                                           );
	event TaskFinalize  (bytes32 indexed taskid,                         bytes   results  );
	event TaskClaimed   (bytes32 indexed taskid                                           );

	event AccurateContribution(address indexed worker, bytes32 indexed taskid);
	event FaultyContribution  (address indexed worker, bytes32 indexed taskid);

	event WorkerSubscription  (address indexed pool, address indexed worker);
	event WorkerUnsubscription(address indexed pool, address indexed worker);
	event WorkerEviction      (address indexed pool, address indexed worker);

	/***************************************************************************
	 *                                Modifiers                                *
	 ***************************************************************************/
	modifier onlyScheduler(bytes32 _taskid)
	{
		require(msg.sender == iexecclerk.viewDeal(m_tasks[_taskid].dealid).pool.owner);
		_;
	}

	/***************************************************************************
	 *                               Constructor                               *
	 ***************************************************************************/
	constructor()
	public
	{
	}

	function attachContracts(
		address _iexecclerkAddress,
		address _dappRegistryAddress,
		address _dataRegistryAddress,
		address _poolRegistryAddress)
	public onlyOwner
	{
		require(address(iexecclerk) == address(0));
		iexecclerk   = IexecClerk  (_iexecclerkAddress  );
		dappregistry = RegistryBase(_dappRegistryAddress);
		dataregistry = RegistryBase(_dataRegistryAddress);
		poolregistry = RegistryBase(_poolRegistryAddress);
	}

	/***************************************************************************
	 *                                Accessors                                *
	 ***************************************************************************/
	function viewTask(bytes32 _taskid)
	public view returns (IexecODBLibCore.Task)
	{
		return m_tasks[_taskid];
	}

	function viewContribution(bytes32 _taskid, address _worker)
	public view returns (IexecODBLibCore.Contribution)
	{
		return m_contributions[_taskid][_worker];
	}

	function viewScore(address _worker)
	public view returns (uint256)
	{
		return m_workerScores[_worker];
	}

	function viewAffectation(address _worker)
	public view returns (Pool)
	{
		return Pool(m_workerAffectations[_worker]);
	}

	function checkResources(address dapp, address data, address pool)
	public view returns (bool)
	{
		require(                      dappregistry.isRegistered(dapp));
		require(data == address(0) || dataregistry.isRegistered(data));
		require(                      poolregistry.isRegistered(pool));
		return true;
	}

	/***************************************************************************
	 *                         EIP 1154 PULL INTERFACE                         *
	 ***************************************************************************/
	function resultFor(bytes32 id) external view returns (bytes result)
	{
		IexecODBLibCore.Task storage task = m_tasks[id];
		require(task.status == IexecODBLibCore.TaskStatusEnum.COMPLETED);
		return task.results;
	}

	/***************************************************************************
	 *                            Consensus methods                            *
	 ***************************************************************************/
	function initialize(bytes32 _dealid, uint256 idx)
	public returns (bytes32)
	{
		IexecODBLibCore.Config memory config = iexecclerk.viewConfig(_dealid);

		require(idx >= config.botFirst                    );
		require(idx <  config.botFirst.add(config.botSize));

		bytes32 taskid = keccak256(abi.encodePacked(_dealid, idx));

		IexecODBLibCore.Task storage task = m_tasks[taskid];
		require(task.status == IexecODBLibCore.TaskStatusEnum.UNSET);
		task.status            = IexecODBLibCore.TaskStatusEnum.ACTIVE;
		task.dealid            = _dealid;
		task.idx               = idx;
		task.consensusDeadline = viewCategory(config.category).workClockTimeRef
		                         .mul(CONSENSUS_DURATION_RATIO)
		                         .add(config.startTime);

		emit TaskInitialize(taskid, iexecclerk.viewDeal(_dealid).pool.pointer);

		return taskid;
	}

	function contribute(
		bytes32                     _taskid,
		bytes32                     _resultHash,
		bytes32                     _resultSeal,
		address                     _enclaveChallenge,
		IexecODBLibOrders.signature _enclaveSign,
		IexecODBLibOrders.signature _poolSign)
	public
	{
		IexecODBLibCore.Task         storage task         = m_tasks[_taskid];
		IexecODBLibCore.Contribution storage contribution = m_contributions[_taskid][msg.sender];
		IexecODBLibCore.Deal         memory  deal         = iexecclerk.viewDeal(task.dealid);

		require(task.status            == IexecODBLibCore.TaskStatusEnum.ACTIVE       );
		require(task.consensusDeadline >  now                                         );
		require(contribution.status    == IexecODBLibCore.ContributionStatusEnum.UNSET);

		// Check that the worker + taskid + enclave combo is authorized to contribute (scheduler signature)
		// Skip check if authorized?
		require(deal.pool.owner == ecrecover(
			keccak256(abi.encodePacked(
				"\x19Ethereum Signed Message:\n32",
				keccak256(abi.encodePacked(
					msg.sender,
					_taskid,
					_enclaveChallenge
				))
			)),
			_poolSign.v,
			_poolSign.r,
			_poolSign.s)
		);

		// worker must be subscribed to the pool, keep?
		require(m_workerAffectations[msg.sender] == deal.pool.pointer);

		// Not needed
		/* require(_resultHash != 0x0); */
		/* require(_resultSeal != 0x0); */

		// need enclave challenge if tag is set
		require(_enclaveChallenge != address(0) || deal.tag & 0x1 == 0);

		// Check enclave signature
		if (_enclaveChallenge != address(0))
		{
			require(_enclaveChallenge == ecrecover(
				keccak256(abi.encodePacked(
					"\x19Ethereum Signed Message:\n32",
					keccak256(abi.encodePacked(
					_resultHash,
					_resultSeal
					))
				)),
				_enclaveSign.v,
				_enclaveSign.r,
				_enclaveSign.s)
			);
		}

		// update contribution entry
		contribution.status           = IexecODBLibCore.ContributionStatusEnum.CONTRIBUTED;
		contribution.enclaveChallenge = _enclaveChallenge;
		contribution.resultHash       = _resultHash;
		contribution.resultSeal       = _resultSeal;
		contribution.score            = m_workerScores[msg.sender].mul(contribution.enclaveChallenge != address(0) ? 3 : 1);
		contribution.weight           = 1 + contribution.score.log();
		task.contributors.push(msg.sender);

		iexecclerk.lockContribution(task.dealid, msg.sender);

		emit TaskContribute(_taskid, msg.sender, _resultHash);
	}

	function consensus(
		bytes32 _taskid,
		bytes32 _consensus)
	public onlyScheduler(_taskid)
	{
		IexecODBLibCore.Task storage task = m_tasks[_taskid];
		require(task.status            == IexecODBLibCore.TaskStatusEnum.ACTIVE);
		require(task.consensusDeadline >  now                                  );

		uint256 winnerCounter = 0;
		for (uint256 i = 0; i < task.contributors.length; ++i)
		{
			address w = task.contributors[i];
			if (
				m_contributions[_taskid][w].resultHash == _consensus
				&&
				m_contributions[_taskid][w].status == IexecODBLibCore.ContributionStatusEnum.CONTRIBUTED // REJECTED contribution must not be count
			)
			{
				winnerCounter = winnerCounter.add(1);
			}
		}
		require(winnerCounter > 0); // you cannot revealConsensus if no worker has contributed to this hash

		task.status         = IexecODBLibCore.TaskStatusEnum.REVEALING;
		task.consensusValue = _consensus;
		task.revealDeadline = viewCategory(iexecclerk.viewConfig(task.dealid).category).workClockTimeRef
		                           .mul(REVEAL_DURATION_RATIO)
		                           .add(now);
		task.revealCounter  = 0;
		task.winnerCounter  = winnerCounter;

		emit TaskConsensus(_taskid, _consensus);
	}

	function reveal(
		bytes32 _taskid,
		bytes32 _resultDigest)
	public // worker
	{
		IexecODBLibCore.Task         storage task         = m_tasks[_taskid];
		IexecODBLibCore.Contribution storage contribution = m_contributions[_taskid][msg.sender];
		require(task.status             == IexecODBLibCore.TaskStatusEnum.REVEALING                       );
		require(task.consensusDeadline  >  now                                                            );
		require(task.revealDeadline     >  now                                                            );
		require(contribution.status     == IexecODBLibCore.ContributionStatusEnum.CONTRIBUTED             );
		require(contribution.resultHash == task.consensusValue                                            );
		require(contribution.resultHash == keccak256(abi.encodePacked(            _taskid, _resultDigest)));
		require(contribution.resultSeal == keccak256(abi.encodePacked(msg.sender, _taskid, _resultDigest)));

		contribution.status = IexecODBLibCore.ContributionStatusEnum.PROVED;
		task.revealCounter  = task.revealCounter.add(1);

		emit TaskReveal(_taskid, msg.sender, _resultDigest);
	}

	function reopen(
		bytes32 _taskid)
	public onlyScheduler(_taskid)
	{
		IexecODBLibCore.Task storage task = m_tasks[_taskid];
		require(task.status            == IexecODBLibCore.TaskStatusEnum.REVEALING);
		require(task.consensusDeadline >  now                                     );
		require(task.revealDeadline    <= now
		     && task.revealCounter     == 0                                       );

		for (uint256 i = 0; i < task.contributors.length; ++i)
		{
			address worker = task.contributors[i];
			if (m_contributions[_taskid][worker].resultHash == task.consensusValue)
			{
				m_contributions[_taskid][worker].status = IexecODBLibCore.ContributionStatusEnum.REJECTED;
			}
		}

		task.status         = IexecODBLibCore.TaskStatusEnum.ACTIVE;
		task.consensusValue = 0x0;
		task.revealDeadline = 0;
		task.winnerCounter  = 0;

		emit TaskReopen(_taskid);
	}

	function finalize(
		bytes32 _taskid,
		bytes   _results)
	public onlyScheduler(_taskid)
	{
		IexecODBLibCore.Task storage task = m_tasks[_taskid];
		require(task.status            == IexecODBLibCore.TaskStatusEnum.REVEALING);
		require(task.consensusDeadline >  now                                     );
		require(task.revealCounter     == task.winnerCounter
		    || (task.revealCounter     >  0  && task.revealDeadline <= now)       );

		task.status  = IexecODBLibCore.TaskStatusEnum.COMPLETED;
		task.results = _results;

		/**
		 * Stake and reward management
		 */
		iexecclerk.successWork(task.dealid);
		__distributeRewards(_taskid);

		/**
		 * Event
		 */
		emit TaskFinalize(_taskid, _results);

		/**
		 * Callback for smartcontracts using EIP1154
		 */
		address callbackTarget = iexecclerk.viewDeal(task.dealid).callback;
		if (callbackTarget != address(0))
		{
			/**
			 * Call does not revert if the target smart contract is incompatible or reverts
			 *
			 * ATTENTION!
			 * This call is dangerous and target smart contract can charge the stack.
			 * Assume invalid state after the call.
			 * See: https://solidity.readthedocs.io/en/develop/types.html#members-of-addresses
			 *
			 * TODO: gas provided?
			 */
			require(gasleft() > 100000);
			callbackTarget.call.gas(100000)(abi.encodeWithSignature(
				"receiveResult(bytes32,bytes)",
				_taskid,
				_results
			));
		}
	}

	function claim(
		bytes32 _taskid)
	public
	{
		IexecODBLibCore.Task storage task = m_tasks[_taskid];
		require(task.status == IexecODBLibCore.TaskStatusEnum.ACTIVE
		     || task.status == IexecODBLibCore.TaskStatusEnum.REVEALING);
		require(task.consensusDeadline <= now                          );

		task.status = IexecODBLibCore.TaskStatusEnum.FAILLED;

		/**
		 * Stake management
		 */
		iexecclerk.failedWork(task.dealid);
		for (uint256 i = 0; i < task.contributors.length; ++i)
		{
			address worker = task.contributors[i];
			iexecclerk.unlockContribution(task.dealid, worker);
		}

		emit TaskClaimed(_taskid);
	}

	function __distributeRewards(bytes32 _taskid)
	private
	{
		IexecODBLibCore.Task   memory task   = m_tasks[_taskid];
		IexecODBLibCore.Config memory config = iexecclerk.viewConfig(task.dealid);

		uint256 i;
		address worker;

		uint256 totalWeight = 0;
		uint256 totalReward = iexecclerk.viewDeal(task.dealid).pool.price;

		for (i = 0; i < task.contributors.length; ++i)
		{
			worker = task.contributors[i];
			if (m_contributions[_taskid][worker].status == IexecODBLibCore.ContributionStatusEnum.PROVED)
			{
				totalWeight = totalWeight.add(m_contributions[_taskid][worker].weight);
			}
			else // ContributionStatusEnum.REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				totalReward = totalReward.add(config.workerStake);
			}
		}
		require(totalWeight > 0);

		// compute how much is going to the workers
		uint256 workersReward = totalReward.percentage(uint256(100).sub(config.schedulerRewardRatio));

		for (i = 0; i < task.contributors.length; ++i)
		{
			worker = task.contributors[i];
			if (m_contributions[_taskid][worker].status == IexecODBLibCore.ContributionStatusEnum.PROVED)
			{
				uint256 workerReward = workersReward.mulByFraction(m_contributions[_taskid][worker].weight, totalWeight);
				totalReward          = totalReward.sub(workerReward);

				iexecclerk.unlockAndRewardForContribution(task.dealid, worker, workerReward);
				// Only reward if replication happened
				if (task.contributors.length > 1)
				{
					m_workerScores[worker] = m_workerScores[worker].add(1);
					emit AccurateContribution(worker, _taskid);
				}
			}
			else // WorkStatusEnum.POCO_REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				// No Reward
				iexecclerk.seizeContribution(task.dealid, worker);
				// Always punish bad contributors
				{
					m_workerScores[worker] = m_workerScores[worker].sub(m_workerScores[worker].min(SCORE_UNITARY_SLASH));
					emit FaultyContribution(worker, _taskid);
				}
			}
		}
		// totalReward now contains the scheduler share
		iexecclerk.rewardForScheduling(task.dealid, totalReward);
	}

	function initializeArray(
		bytes32[] _dealid,
		uint256[] _idx)
	public returns (bool)
	{
		require(_dealid.length == _idx.length);
		for (uint i = 0; i < _dealid.length; ++i)
		{
			initialize(_dealid[i], _idx[i]);
		}
		return true;
	}

	function claimArray(
		bytes32[] _taskid)
	public returns (bool)
	{
		for (uint i = 0; i < _taskid.length; ++i)
		{
			claim(_taskid[i]);
		}
		return true;
	}

	/***************************************************************************
	 *                       Worker affectation methods                        *
	 ***************************************************************************/
	function subscribe(Pool _pool)
	public returns (bool)
	{
		// check pools validity
		require(poolregistry.isRegistered(_pool));

		// check worker is not previously affected: AUTO unsubscribe ???
		require(m_workerAffectations[msg.sender] == address(0));

		// Lock stake & check funds/reputation
		iexecclerk.lockSubscription(msg.sender, _pool.m_subscriptionLockStakePolicy());
		require(iexecclerk.viewAccount(msg.sender).stake >= _pool.m_subscriptionMinimumStakePolicy());
		require(m_workerScores[msg.sender]               >= _pool.m_subscriptionMinimumScorePolicy());

		// update affectation
		m_workerAffectations[msg.sender] = address(_pool);

		emit WorkerSubscription(address(_pool), msg.sender);
		return true;
	}

	function unsubscribe()
	public returns (bool)
	{
		// check affectation
		Pool pool = Pool(m_workerAffectations[msg.sender]);
		require(address(pool) != address(0));

		// Unlock stake
		iexecclerk.unlockSubscription(msg.sender, pool.m_subscriptionLockStakePolicy());

		// update affectation
		m_workerAffectations[msg.sender] = address(0);

		emit WorkerUnsubscription(address(pool), msg.sender);
		return true;
	}

	function evict(address _worker)
	public returns (bool)
	{
		// check affectation & authorization
		Pool pool = Pool(m_workerAffectations[_worker]);
		require(address(pool)  != address(0));
		require(pool.m_owner() == msg.sender);

		// Unlock stake
		iexecclerk.unlockSubscription(_worker, pool.m_subscriptionLockStakePolicy());

		// update affectation
		m_workerAffectations[_worker] = address(0);

		emit WorkerEviction(address(pool), _worker);
		return true;
	}
}
