pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./IexecODBLib.sol";
import "./tools/SafeMathOZ.sol";

import "./CategoryManager.sol";

import "./IexecClerk.sol";
import "./registries/RegistryBase.sol";
/* import "./registries/DappRegistry.sol"; */
/* import "./registries/DataRegistry.sol"; */
/* import "./registries/PoolRegistry.sol"; */

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
	IexecClerk   iexecclerk;
	RegistryBase dappregistry;
	RegistryBase dataregistry;
	RegistryBase poolregistry;
	/* DappRegistry dappregistry; */
	/* DataRegistry dataregistry; */
	/* PoolRegistry poolregistry; */

	/***************************************************************************
	 *                               Consensuses                               *
	 ***************************************************************************/
	mapping(bytes32 => IexecODBLib.WorkOrder)                        m_workorders;
	mapping(bytes32 => mapping(address => IexecODBLib.Contribution)) m_contributions;

	/***************************************************************************
	 *                                 Workers                                 *
	 ***************************************************************************/
	mapping(address => uint256) public m_workerScores;
	mapping(address => address) public m_workerAffectations;

	/***************************************************************************
	 *                                 Events                                  *
	 ***************************************************************************/
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
	modifier onlyScheduler(bytes32 _woid)
	{
		require(msg.sender == iexecclerk.viewDeal(m_workorders[_woid].dealid).pool.owner);
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
		/* dappregistry = DappRegistry(_dappRegistryAddress); */
		/* dataregistry = DataRegistry(_dataRegistryAddress); */
		/* poolregistry = PoolRegistry(_poolRegistryAddress); */
	}

	/***************************************************************************
	 *                                Accessors                                *
	 ***************************************************************************/
	function viewWorkorder(bytes32 _woid)
	public view returns (IexecODBLib.WorkOrder)
	{
		return m_workorders[_woid];
	}

	function viewContribution(bytes32 _woid, address _worker)
	public view returns (IexecODBLib.Contribution)
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
		require(                      dappregistry.isRegistered(daap));
		require(data == address(0) || dataregistry.isRegistered(data));
		require(                      poolregistry.isRegistered(pool));
		return true;
	}

	/***************************************************************************
	 *                            Consensus methods                            *
	 ***************************************************************************/
	function initialize(bytes32 _dealid, uint256 idx)
	public returns (bytes32)
	{
		IexecODBLib.Config memory config = iexecclerk.viewConfig(_dealid);

		require(idx >= config.botFirst                    );
		require(idx <  config.botFirst.add(config.botSize));

		bytes32 woid = keccak256(abi.encodePacked(_dealid, idx));

		IexecODBLib.WorkOrder storage workorder = m_workorders[woid];
		require(workorder.status == IexecODBLib.WorkOrderStatusEnum.UNSET);
		workorder.status            = IexecODBLib.WorkOrderStatusEnum.ACTIVE;
		workorder.dealid            = _dealid;
		workorder.idx               = idx;
		workorder.consensusDeadline = viewCategory(config.category).workClockTimeRef
		                              .mul(CONSENSUS_DURATION_RATIO)
		                              .add(config.startTime);

		emit ConsensusInitialize(woid, iexecclerk.viewDeal(_dealid).pool.pointer);

		return woid;
	}

	function signedContribute(
		bytes32              _woid,
		bytes32              _resultHash,
		bytes32              _resultSign,
		address              _enclaveChallenge,
		IexecODBLib.signature _enclaveSign,
		IexecODBLib.signature _poolSign)
	public
	{
		IexecODBLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == IexecODBLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );

		IexecODBLib.Deal memory deal = iexecclerk.viewDeal(workorder.dealid);
		//Check that the worker + woid + enclave combo is authorized to contribute (scheduler signature)
		require(deal.pool.owner == ecrecover(
			keccak256(abi.encodePacked(
				"\x19Ethereum Signed Message:\n32",
				keccak256(abi.encodePacked(
					msg.sender,
					_woid,
					_enclaveChallenge
				))
			)),
			_poolSign.v,
			_poolSign.r,
			_poolSign.s)
		);

		IexecODBLib.Contribution storage contribution = m_contributions[_woid][msg.sender];
		require(contribution.status == IexecODBLib.ContributionStatusEnum.UNSET
		     || contribution.status == IexecODBLib.ContributionStatusEnum.AUTHORIZED);

		// worker must be subscribed to the pool
		// TODO: required ?
		require(m_workerAffectations[msg.sender] == deal.pool.pointer);

		// need enclave challenge if tag is set
		require(_enclaveChallenge != address(0) || deal.tag & 0x1 == 0);

		require(_resultHash != 0x0);
		require(_resultSign != 0x0);
		// Check enclave signature
		if (_enclaveChallenge != address(0))
		{
			require(_enclaveChallenge == ecrecover(
				keccak256(abi.encodePacked(
					"\x19Ethereum Signed Message:\n32",
					keccak256(abi.encodePacked(
					_resultHash,
					_resultSign
					))
				)),
				_enclaveSign.v,
				_enclaveSign.r,
				_enclaveSign.s)
			);
		}

		// update contribution entry
		contribution.status           = IexecODBLib.ContributionStatusEnum.CONTRIBUTED;
		contribution.enclaveChallenge = _enclaveChallenge;
		contribution.resultHash       = _resultHash;
		contribution.resultSign       = _resultSign;
		contribution.score            = m_workerScores[msg.sender].mul(contribution.enclaveChallenge != address(0) ? 3 : 1);
		contribution.weight           = 1 + contribution.score.log();
		workorder.contributors.push(msg.sender);

		require(iexecclerk.lockContribution(workorder.dealid, msg.sender));

		emit ConsensusContribute(_woid, msg.sender, _resultHash);
	}

	function revealConsensus(
		bytes32 _woid,
		bytes32 _consensus)
	public onlyScheduler(_woid)
	{
		IexecODBLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == IexecODBLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );

		uint256 winnerCounter = 0;
		for (uint256 i = 0; i<workorder.contributors.length; ++i)
		{
			address w = workorder.contributors[i];
			if (
				m_contributions[_woid][w].resultHash == _consensus
				&&
				m_contributions[_woid][w].status == IexecODBLib.ContributionStatusEnum.CONTRIBUTED // REJECTED contribution must not be count
			)
			{
				winnerCounter = winnerCounter.add(1);
			}
		}
		require(winnerCounter > 0); // you cannot revealConsensus if no worker has contributed to this hash

		workorder.status         = IexecODBLib.WorkOrderStatusEnum.REVEALING;
		workorder.consensusValue = _consensus;
		workorder.revealDeadline = viewCategory(iexecclerk.viewConfig(workorder.dealid).category).workClockTimeRef
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
		IexecODBLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == IexecODBLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealDeadline    >  now                                     );

		IexecODBLib.Contribution storage contribution = m_contributions[_woid][msg.sender];
		require(contribution.status         == IexecODBLib.ContributionStatusEnum.CONTRIBUTED);
		require(contribution.resultHash     == workorder.consensusValue);
		require(contribution.resultHash     == keccak256(abi.encodePacked(            _result)));
		require(contribution.resultSign     == keccak256(abi.encodePacked(msg.sender, _result)));

		contribution.status     = IexecODBLib.ContributionStatusEnum.PROVED;
		workorder.revealCounter = workorder.revealCounter.add(1);

		emit ConsensusReveal(_woid, msg.sender, _result);
	}

	function reopen(
		bytes32 _woid)
	public onlyScheduler(_woid)
	{
		IexecODBLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == IexecODBLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealDeadline    <= now
		     && workorder.revealCounter     == 0                                       );

		for (uint256 i = 0; i < workorder.contributors.length; ++i)
		{
			address worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].resultHash == workorder.consensusValue)
			{
				m_contributions[_woid][worker].status = IexecODBLib.ContributionStatusEnum.REJECTED;
			}
		}

		workorder.status         = IexecODBLib.WorkOrderStatusEnum.ACTIVE;
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
		IexecODBLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == IexecODBLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealCounter     == workorder.winnerCounter
		    || (workorder.revealCounter     >  0  && workorder.revealDeadline <= now)  );

		workorder.status = IexecODBLib.WorkOrderStatusEnum.COMPLETED;

		/**
		 * Stake and reward management
		 */
		require(iexecclerk.successWork(workorder.dealid));
		__distributeRewards(_woid);

		emit ConsensusFinalized(_woid, _stdout, _stderr, _uri);
	}

	function claimfailed(
		bytes32 _woid)
	public
	{
		IexecODBLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status == IexecODBLib.WorkOrderStatusEnum.ACTIVE
		     || workorder.status == IexecODBLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline <= now);

		workorder.status = IexecODBLib.WorkOrderStatusEnum.FAILLED;

		/**
		 * Stake management
		 */
		require(iexecclerk.failedWork(workorder.dealid));
		for (uint256 i = 0; i < workorder.contributors.length; ++i)
		{
			address worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].status != IexecODBLib.ContributionStatusEnum.AUTHORIZED) // Contributed, proved or rejected
			{
				require(iexecclerk.unlockContribution(workorder.dealid, worker));
			}
		}

		emit ConsensusClaimed(_woid);
	}

	function __distributeRewards(bytes32 _woid)
	private
	{
		IexecODBLib.WorkOrder storage workorder = m_workorders[_woid];
		IexecODBLib.Config    memory  config    = iexecclerk.viewConfig(workorder.dealid);

		uint256 i;
		address worker;

		uint256 totalWeight = 0;
		uint256 totalReward = iexecclerk.viewDeal(workorder.dealid).pool.price;

		for (i = 0; i<workorder.contributors.length; ++i)
		{
			worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].status == IexecODBLib.ContributionStatusEnum.PROVED)
			{
				totalWeight  = totalWeight.add(m_contributions[_woid][worker].weight);
			}
			else // ContributionStatusEnum.REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				totalReward = totalReward.add(config.workerStake);
			}
		}
		require(totalWeight > 0);

		// compute how much is going to the workers
		uint256 workersReward = totalReward.percentage(uint256(100).sub(config.schedulerRewardRatio));

		for (i = 0; i<workorder.contributors.length; ++i)
		{
			worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].status == IexecODBLib.ContributionStatusEnum.PROVED)
			{
				uint256 workerReward = workersReward.mulByFraction(m_contributions[_woid][worker].weight, totalWeight);
				totalReward          = totalReward.sub(workerReward);

				require(iexecclerk.unlockAndRewardForContribution(workorder.dealid, worker, workerReward));
				m_workerScores[worker] = m_workerScores[worker].add(1);
				emit AccurateContribution(_woid, worker);
			}
			else // WorkStatusEnum.POCO_REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				// No Reward
				require(iexecclerk.seizeContribution(workorder.dealid, worker));
				m_workerScores[worker] = m_workerScores[worker].sub(m_workerScores[worker].min(SCORE_UNITARY_SLASH));
				emit FaultyContribution(_woid, worker);
			}
		}
		// totalReward now contains the scheduler share
		require(iexecclerk.rewardForScheduling(workorder.dealid, totalReward));
	}

	/***************************************************************************
	 *                       Worker affectation methods                        *
	 ***************************************************************************/
	function subscribe(Pool _pool)
	public returns (bool)
	{
		require(poolregistry.isRegistered(_pool));

		require(m_workerAffectations[msg.sender] == address(0));
		require(iexecclerk.lockSubscription(msg.sender, _pool.m_subscriptionLockStakePolicy()));
		require(iexecclerk.viewAccount(msg.sender).stake >= _pool.m_subscriptionMinimumStakePolicy());
		require(m_workerScores[msg.sender]               >= _pool.m_subscriptionMinimumScorePolicy());
		m_workerAffectations[msg.sender] = address(_pool);

		emit WorkerSubscription(address(_pool), msg.sender);
		return true;
	}

	function unsubscribe()
	public returns (bool)
	{
		Pool pool = Pool(m_workerAffectations[msg.sender]);
		require(address(pool) != address(0));

		require(iexecclerk.unlockSubscription(msg.sender, pool.m_subscriptionLockStakePolicy()));
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

		require(iexecclerk.unlockSubscription(_worker, pool.m_subscriptionLockStakePolicy()));
		m_workerAffectations[_worker] = address(0);

		emit WorkerEviction(address(pool), _worker);
		return true;
	}
}
