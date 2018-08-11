pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./Iexec0xLib.sol";
import "./tools/SafeMathOZ.sol";

import "./CategoryManager.sol";

import "./Marketplace.sol";
import "./resources_contract/DappRegistry.sol";
import "./resources_contract/DataRegistry.sol";
import "./resources_contract/PoolRegistry.sol";

contract IexecHub is CategoryManager
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
	Marketplace  marketplace;
	DappRegistry dappregistry;
	DataRegistry dataregistry;
	PoolRegistry poolregistry;

	/***************************************************************************
	 *                               Consensuses                               *
	 ***************************************************************************/
	mapping(bytes32 => Iexec0xLib.WorkOrder)                        m_workorders;
	mapping(bytes32 => mapping(address => Iexec0xLib.Contribution)) m_contributions;

	/***************************************************************************
	 *                                 Workers                                 *
	 ***************************************************************************/
	mapping(address => uint256) public m_workerScores;
	mapping(address => address) public m_workerAffectations;

	/***************************************************************************
	 *                                 Events                                  *
	 ***************************************************************************/
	event CreateDapp(address indexed dappOwner, address indexed dapp, string dappName, string dappParams);
	event CreateData(address indexed dataOwner, address indexed data, string dataName, string dataParams);
	event CreatePool(address indexed poolOwner, address indexed pool, string poolDescription);

	event ConsensusInitialize       (bytes32 indexed woid, address indexed pool);
	event ConsensusAllowContribution(bytes32 indexed woid, address indexed worker);
	event ConsensusContribute       (bytes32 indexed woid, address indexed worker, bytes32 resultHash);
	event ConsensusRevealConsensus  (bytes32 indexed woid, bytes32 consensus);
	event ConsensusReveal           (bytes32 indexed woid, address indexed worker, bytes32 result);
	event ConsensusReopen           (bytes32 indexed woid);
	event ConsensusFinalized        (bytes32 indexed woid, string stdout, string stderr, string uri);
	event ConsensusClaimed          (bytes32 indexed woid);
	event AccurateContribution      (bytes32 indexed woid, address indexed worker);
	event FaultyContribution        (bytes32 indexed woid, address indexed worker);

	event WorkerSubscription  (address indexed pool, address worker);
	event WorkerUnsubscription(address indexed pool, address worker);
	event WorkerEviction      (address indexed pool, address worker);

	/***************************************************************************
	 *                                Modifiers                                *
	 ***************************************************************************/
	modifier onlyMarketplace()
	{
		require(msg.sender == address(marketplace));
		_;
	}

	modifier onlyScheduler(bytes32 _woid)
	{
		require(msg.sender == marketplace.viewDeal(_woid).pool.owner);
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
		address _marketplaceAddress,
		address _dappRegistryAddress,
		address _dataRegistryAddress,
		address _poolRegistryAddress)
	public onlyOwner
	{
		require(address(marketplace) == address(0));
		marketplace  = Marketplace (_marketplaceAddress );
		dappregistry = DappRegistry(_dappRegistryAddress);
		dataregistry = DataRegistry(_dataRegistryAddress);
		poolregistry = PoolRegistry(_poolRegistryAddress);
	}

	/***************************************************************************
	 *                                Accessors                                *
	 ***************************************************************************/
	function viewWorkorder(bytes32 _woid)
	public view returns (Iexec0xLib.WorkOrder)
	{
		return m_workorders[_woid];
	}

	function viewContribution(bytes32 _woid, address _worker)
	public view returns (Iexec0xLib.Contribution)
	{
		return m_contributions[_woid][_worker];
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

	function checkResources(address daap, address data, address pool)
	public view returns (bool)
	{
		return dappregistry.isRegistered(daap)
		    && dataregistry.isRegistered(data)
		    && poolregistry.isRegistered(pool);
	}

	/***************************************************************************
	 *                            Consensus methods                            *
	 ***************************************************************************/
	function initialize(
		bytes32 _woid)
	public onlyMarketplace
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status == Iexec0xLib.WorkOrderStatusEnum.UNSET);

		workorder.status            = Iexec0xLib.WorkOrderStatusEnum.ACTIVE;
		workorder.consensusDeadline = viewCategory(marketplace.viewDeal(_woid).category).workClockTimeRef
		                              .mul(CONSENSUS_DURATION_RATIO)
		                              .add(now);

		emit ConsensusInitialize(_woid, marketplace.viewDeal(_woid).pool.owner);
	}

	// NEW → contribute that skips the allowWorkerToContribute step with scheduler signature
	function signedContribute(
		bytes32              _woid,
		bytes32              _resultHash,
		bytes32              _resultSign,
		address              _enclaveChallenge,
		Iexec0xLib.signature _enclaveSign,
		Iexec0xLib.signature _poolSign)
	public
	{
		/**
		 * Check that the worker + woid + enclave combo is
		 *  authorized to contribute (scheduler signature)
		 */
		require(marketplace.viewDeal(_woid).pool.pointer == ecrecover(
			keccak256(
				"\x19Ethereum Signed Message:\n32",
				keccak256(msg.sender, _woid, _enclaveChallenge)
			),
			_poolSign.v,
			_poolSign.r,
			_poolSign.s)
		);

		// If first byte of tag is active then an enclave must be specified
		require(_enclaveChallenge != address(0) || marketplace.viewDeal(_woid).tag & 0x1 == 0);

		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );

		Iexec0xLib.Contribution storage contribution = m_contributions[_woid][msg.sender];
		require(contribution.status == Iexec0xLib.ContributionStatusEnum.UNSET);

		// worker must be subscribed to the pool
		// TODO: required ?
		require(m_workerAffectations[msg.sender] == marketplace.viewDeal(_woid).pool.pointer);

		require(_resultHash != 0x0);
		require(_resultSign != 0x0);
		// Check enclave signature
		if (_enclaveChallenge != address(0))
		{
			require(_enclaveChallenge == ecrecover(
				keccak256(
					"\x19Ethereum Signed Message:\n64",
					_resultHash,
					_resultSign
				),
				_enclaveSign.v,
				_enclaveSign.r,
				_enclaveSign.s)
			);
		}

		// update contribution entry
		contribution.status           = Iexec0xLib.ContributionStatusEnum.CONTRIBUTED;
		contribution.enclaveChallenge = _enclaveChallenge;
		contribution.resultHash       = _resultHash;
		contribution.resultSign       = _resultSign;
		contribution.score            = m_workerScores[msg.sender].mul(contribution.enclaveChallenge != address(0) ? 3 : 1);
		contribution.weight           = 1 + contribution.score.log();
		workorder.contributors.push(msg.sender);

		require(marketplace.lockContribution(_woid, msg.sender));

		emit ConsensusContribute(_woid, msg.sender, _resultHash);
	}

	function allowWorkerToContribute(
		bytes32 _woid,
		address _worker,
		address _enclaveChallenge)
	public onlyScheduler(_woid)
	{
		// If first byte of tag is active then an enclave must be specified
		require(_enclaveChallenge != address(0) || marketplace.viewDeal(_woid).tag & 0x1 == 0);

		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );

		Iexec0xLib.Contribution storage contribution = m_contributions[_woid][_worker];
		require(contribution.status == Iexec0xLib.ContributionStatusEnum.UNSET);

		// worker must be subscribed to the pool
		require(m_workerAffectations[_worker] == marketplace.viewDeal(_woid).pool.pointer);

		// authorize contribution
		contribution.status           = Iexec0xLib.ContributionStatusEnum.AUTHORIZED;
		contribution.enclaveChallenge = _enclaveChallenge;

		emit ConsensusAllowContribution(_woid, _worker);
	}

	function allowWorkersToContribute(
		bytes32   _woid,
		address[] _workers,
		address   _enclaveChallenge)
	public onlyScheduler(_woid)
	{
		for (uint i = 0; i < _workers.length; ++i)
		{
			allowWorkerToContribute(_woid, _workers[i], _enclaveChallenge);
		}
	}

	function contribute(
		bytes32              _woid,
		bytes32              _resultHash,
		bytes32              _resultSign,
		Iexec0xLib.signature _challengeSign)
	public // worker
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );

		Iexec0xLib.Contribution storage contribution = m_contributions[_woid][msg.sender];
		require(contribution.status == Iexec0xLib.ContributionStatusEnum.AUTHORIZED);

		require(_resultHash != 0x0);
		require(_resultSign != 0x0);
		if (contribution.enclaveChallenge != address(0))
		{
			require(contribution.enclaveChallenge == ecrecover(keccak256(
				"\x19Ethereum Signed Message:\n64",
				_resultHash,
				_resultSign),
				_challengeSign.v,
				_challengeSign.r,
				_challengeSign.s)
			);
		}

		contribution.status     = Iexec0xLib.ContributionStatusEnum.CONTRIBUTED;
		contribution.resultHash = _resultHash;
		contribution.resultSign = _resultSign;
		contribution.score      = m_workerScores[msg.sender].mul(contribution.enclaveChallenge != address(0) ? 3 : 1);
		contribution.weight     = 1 + contribution.score.log();
		workorder.contributors.push(msg.sender);

		require(marketplace.lockContribution(_woid, msg.sender));

		emit ConsensusContribute(_woid, msg.sender, _resultHash);
	}

	function revealConsensus(
		bytes32 _woid,
		bytes32 _consensus)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );

		uint256 winnerCounter = 0;
		for (uint256 i = 0; i<workorder.contributors.length; ++i)
		{
			address w = workorder.contributors[i];
			if (
				m_contributions[_woid][w].resultHash == _consensus
				&&
				m_contributions[_woid][w].status == Iexec0xLib.ContributionStatusEnum.CONTRIBUTED // REJECTED contribution must not be count
			)
			{
				winnerCounter = winnerCounter.add(1);
			}
		}
		require(winnerCounter > 0); // you cannot revealConsensus if no worker has contributed to this hash

		workorder.status         = Iexec0xLib.WorkOrderStatusEnum.REVEALING;
		workorder.consensusValue = _consensus;
		workorder.revealDeadline = viewCategory(marketplace.viewDeal(_woid).category).workClockTimeRef
		                           .mul(REVEAL_DURATION_RATIO)
		                           .add(now);
		workorder.revealCounter  = 0;
		workorder.winnerCounter  = winnerCounter;

		emit ConsensusRevealConsensus(_woid, _consensus);
	}

	function reveal(
		bytes32 _woid,
		bytes32 _result)
	public // worker
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealDeadline    >  now                                     );

		Iexec0xLib.Contribution storage contribution = m_contributions[_woid][msg.sender];
		require(contribution.status         == Iexec0xLib.ContributionStatusEnum.CONTRIBUTED);
		require(contribution.resultHash     == workorder.consensusValue                     );
		require(contribution.resultHash     == keccak256(_result                        )   );
		require(contribution.resultSign     == keccak256(_result ^ keccak256(msg.sender))   );

		contribution.status     = Iexec0xLib.ContributionStatusEnum.PROVED;
		workorder.revealCounter = workorder.revealCounter.add(1);

		emit ConsensusReveal(_woid, msg.sender, _result);
	}

	function reopen(
		bytes32 _woid)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealDeadline    <= now
		     && workorder.revealCounter     == 0                                       );

		for (uint256 i = 0; i < workorder.contributors.length; ++i)
		{
			address worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].resultHash == workorder.consensusValue)
			{
				m_contributions[_woid][worker].status = Iexec0xLib.ContributionStatusEnum.REJECTED;
			}
		}

		workorder.status         = Iexec0xLib.WorkOrderStatusEnum.ACTIVE;
		workorder.consensusValue = 0x0;
		workorder.revealDeadline = 0;
		workorder.winnerCounter  = 0;

		emit ConsensusReopen(_woid);
	}

	function finalizeWork(
		bytes32 _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealCounter     == workorder.winnerCounter
		    || (workorder.revealCounter     >  0  && workorder.revealDeadline <= now)  );

		workorder.status = Iexec0xLib.WorkOrderStatusEnum.COMPLETED;

		/**
		 * Stake and reward management
		 */
		require(marketplace.successWork(_woid));
		__distributeRewards(_woid);

		emit ConsensusFinalized(_woid, _stdout, _stderr, _uri);
	}

	function claimfailed(
		bytes32 _woid)
	public
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status == Iexec0xLib.WorkOrderStatusEnum.ACTIVE
		     || workorder.status == Iexec0xLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline <= now);

		workorder.status = Iexec0xLib.WorkOrderStatusEnum.FAILLED;

		/**
		 * Stake management
		 */
		require(marketplace.failedWork(_woid));
		for (uint256 i = 0; i < workorder.contributors.length; ++i)
		{
			address worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].status != Iexec0xLib.ContributionStatusEnum.AUTHORIZED) // Contributed, proved or rejected
			{
				require(marketplace.unlockContribution(_woid, worker));
			}
		}

		emit ConsensusClaimed(_woid);
	}

	function __distributeRewards(bytes32 _woid)
	private
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];

		uint256 i;
		address worker;

		uint256 totalWeight = 0;
		uint256 totalReward = marketplace.viewDeal(_woid).pool.price;
		uint256 workerStake = marketplace.viewDeal(_woid).workerStake;

		for (i = 0; i<workorder.contributors.length; ++i)
		{
			worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].status == Iexec0xLib.ContributionStatusEnum.PROVED)
			{
				totalWeight  = totalWeight.add(m_contributions[_woid][worker].weight);
			}
			else // ContributionStatusEnum.REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				totalReward = totalReward.add(workerStake);
			}
		}
		require(totalWeight > 0);

		// compute how much is going to the workers
		uint256 workersReward = totalReward.percentage(uint256(100).sub(marketplace.viewDeal(_woid).schedulerRewardRatio));

		for (i = 0; i<workorder.contributors.length; ++i)
		{
			worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].status == Iexec0xLib.ContributionStatusEnum.PROVED)
			{
				uint256 workerReward = workersReward.mulByFraction(m_contributions[_woid][worker].weight, totalWeight);
				totalReward          = totalReward.sub(workerReward);

				require(marketplace.unlockContribution   (_woid, worker));
				require(marketplace.rewardForContribution(_woid, worker, workerReward));
				m_workerScores[worker] = m_workerScores[worker].add(1);

				emit AccurateContribution(_woid, worker);
			}
			else // WorkStatusEnum.POCO_REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				// No Reward
				require(marketplace.seizeContribution(_woid, worker));
				m_workerScores[worker] = m_workerScores[worker].sub(SCORE_UNITARY_SLASH);

				emit FaultyContribution(_woid, worker);
			}
		}
		// totalReward now contains the scheduler share
		require(marketplace.rewardForScheduling(_woid, totalReward));
	}

	/***************************************************************************
	 *                       Worker affectation methods                        *
	 ***************************************************************************/
	function subscribe(Pool _pool)
	public returns (bool)
	{
		require(poolregistry.isRegistered(_pool));

		require(m_workerAffectations[msg.sender] == address(0));
		require(marketplace.lockSubscription(msg.sender, _pool.m_subscriptionLockStakePolicy()));
		require(marketplace.viewAccount(msg.sender).stake >= _pool.m_subscriptionMinimumStakePolicy());
		require(m_workerScores[msg.sender]                >= _pool.m_subscriptionMinimumScorePolicy());
		m_workerAffectations[msg.sender] = address(_pool);

		emit WorkerSubscription(address(_pool), msg.sender);
		return true;
	}

	function unsubscribe()
	public returns (bool)
	{
		Pool pool = Pool(m_workerAffectations[msg.sender]);
		require(address(pool) != address(0));

		require(marketplace.unlockSubscription(msg.sender, pool.m_subscriptionLockStakePolicy()));
		m_workerAffectations[msg.sender] = address(0);

		emit WorkerUnsubscription(address(pool), msg.sender);
		return true;
	}

	function evict(address _worker)
	public returns (bool)
	{
		Pool pool = Pool(m_workerAffectations[_worker]);
		require(address(pool)  != address(0));
		require(pool.m_owner() == msg.sender);

		require(marketplace.unlockSubscription(_worker, pool.m_subscriptionLockStakePolicy()));
		m_workerAffectations[_worker] = address(0);

		emit WorkerEviction(address(pool), _worker);
		return true;
	}

	/***************************************************************************
	 *                                Hub Proxy                                *
	 ***************************************************************************/
	// TODO: remove proxy for gas ?
	function createDapp(
		string  _dappName,
		string  _dappParams)
	public returns (Dapp)
	{
		Dapp newDapp = dappregistry.createDapp(msg.sender, _dappName, _dappParams);
		emit CreateDapp(msg.sender, newDapp, _dappName, _dappParams);
		return newDapp;
	}

	function createData(
		string  _dataName,
		string  _dataParams)
	public returns (Data)
	{
		Data newData = dataregistry.createData(msg.sender, _dataName, _dataParams);
		emit CreateData(msg.sender, newData, _dataName, _dataParams);
		return newData;
	}

	function createPool(
		string  _poolDescription,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy)
	public returns (Pool)
	{
		Pool newPool = poolregistry.createPool(
			msg.sender,
			_poolDescription,
			_subscriptionLockStakePolicy,
			_subscriptionMinimumStakePolicy,
			_subscriptionMinimumScorePolicy
		);
		emit CreatePool(msg.sender, newPool, _poolDescription);
		return newPool;
	}

}
