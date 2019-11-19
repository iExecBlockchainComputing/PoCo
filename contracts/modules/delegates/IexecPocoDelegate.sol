pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./IexecERC20Common.sol";
import "../DelegateBase.sol";
import "../interfaces/IexecPoco.sol";
import "../../libs/SignatureVerifier.sol";


contract IexecPocoDelegate is IexecPoco, DelegateBase, IexecERC20Common, SignatureVerifier
{
	using SafeMathExtended     for uint256;
	using IexecODBLibOrders_v4 for bytes32;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.AppOrder;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.DatasetOrder;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.WorkerpoolOrder;
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.RequestOrder;

	/***************************************************************************
	 *                        Escrow methods: internal                         *
	 ***************************************************************************/
	function reward(address user, uint256 amount, bytes32 ref)
		internal /* returns (bool) */
	{
		_transfer(address(this), user, amount);
		emit Reward(user, amount, ref);
		/* return true; */
	}

	function seize(address user, uint256 amount, bytes32 ref)
		internal /* returns (bool) */
	{
		m_frozens[user] = m_frozens[user].sub(amount);
		emit Seize(user, amount, ref);
		/* return true; */
	}

	function lock(address user, uint256 amount)
		internal /* returns (bool) */
	{
		_transfer(user, address(this), amount);
		m_frozens[user] = m_frozens[user].add(amount);
		emit Lock(user, amount);
		/* return true; */
	}

	function unlock(address user, uint256 amount)
		internal /* returns (bool) */
	{
		_transfer(address(this), user, amount);
		m_frozens[user] = m_frozens[user].sub(amount);
		emit Unlock(user, amount);
		/* return true; */
	}

	/***************************************************************************
	 *                    Escrow overhead for contribution                     *
	 ***************************************************************************/
	function lockContribution(bytes32 _dealid, address _worker)
		internal
	{
		lock(_worker, m_deals[_dealid].workerStake);
	}

	function unlockContribution(bytes32 _dealid, address _worker)
		internal
	{
		unlock(_worker, m_deals[_dealid].workerStake);
	}

	function rewardForContribution(address _worker, uint256 _amount, bytes32 _taskid)
		internal
	{
		reward(_worker, _amount, _taskid);
	}

	function seizeContribution(bytes32 _dealid, address _worker, bytes32 _taskid)
		internal
	{
		seize(_worker, m_deals[_dealid].workerStake, _taskid);
	}

	function rewardForScheduling(bytes32 _dealid, uint256 _amount, bytes32 _taskid)
		internal
	{
		reward(m_deals[_dealid].workerpool.owner, _amount, _taskid);
	}

	function successWork(bytes32 _dealid, bytes32 _taskid)
		internal
	{
		IexecODBLibCore_v4.Deal storage deal = m_deals[_dealid];

		uint256 requesterstake = deal.app.price
		                         .add(deal.dataset.price)
		                         .add(deal.workerpool.price);
		uint256 poolstake = deal.workerpool.price
		                    .percentage(WORKERPOOL_STAKE_RATIO);

		// seize requester funds
		seize(deal.requester, requesterstake, _taskid);
		// dapp reward
		if (deal.app.price > 0)
		{
			reward(deal.app.owner, deal.app.price, _taskid);
		}
		// data reward
		if (deal.dataset.price > 0 && deal.dataset.pointer != address(0))
		{
			reward(deal.dataset.owner, deal.dataset.price, _taskid);
		}
		// unlock pool stake
		unlock(deal.workerpool.owner, poolstake);
		// pool reward performed by consensus manager

		/**
		 * Retrieve part of the kitty
		 * TODO: remove / keep ?
		 */
		uint256 kitty = m_frozens[KITTY_ADDRESS];
		if (kitty > 0)
		{
			kitty = kitty
			        .percentage(KITTY_RATIO) // fraction
			        .max(KITTY_MIN)          // at least this
			        .min(kitty);             // but not more than available
			seize (KITTY_ADDRESS,         kitty, _taskid);
			reward(deal.workerpool.owner, kitty, _taskid);
		}
	}

	function failedWork(bytes32 _dealid, bytes32 _taskid)
		internal
	{
		IexecODBLibCore_v4.Deal storage deal = m_deals[_dealid];

		uint256 requesterstake = deal.app.price
		                         .add(deal.dataset.price)
		                         .add(deal.workerpool.price);
		uint256 poolstake = deal.workerpool.price
		                    .percentage(WORKERPOOL_STAKE_RATIO);

		unlock(deal.requester,        requesterstake    );
		seize (deal.workerpool.owner, poolstake, _taskid);
		reward(KITTY_ADDRESS,         poolstake, _taskid); // → Kitty / Burn
		lock  (KITTY_ADDRESS,         poolstake         ); // → Kitty / Burn
	}

	/***************************************************************************
	 *                           ODB order signature                           *
	 ***************************************************************************/
	function verifySignature(address _identity, bytes32 _hash, bytes calldata _signature)
	external view returns (bool)
	{
		return _checkSignature(_identity, _hash, _signature);
	}

	function verifyPresignature(address _identity, bytes32 _hash)
	external view returns (bool)
	{
		return _checkPresignature(_identity, _hash);
	}

	function verifyPresignatureOrSignature(address _identity, bytes32 _hash, bytes calldata _signature)
	external view returns (bool)
	{
		return _checkPresignatureOrSignature(_identity, _hash, _signature);
	}

	function _checkPresignature(address _identity, bytes32 _hash)
	internal view returns (bool)
	{
		return _identity != address(0) && _identity == m_presigned[_hash];
	}

	function _checkPresignatureOrSignature(address _identity, bytes32 _hash, bytes memory _signature)
	internal view returns (bool)
	{
		return _checkPresignature(_identity, _hash) || _checkSignature(_identity, _hash, _signature);
	}

	/***************************************************************************
	 *                           ODB order matching                            *
	 ***************************************************************************/
	struct Identities
	{
		bytes32 appHash;
		address appOwner;
		bytes32 datasetHash;
		address datasetOwner;
		bytes32 workerpoolHash;
		address workerpoolOwner;
		bytes32 requestHash;
		bool    hasDataset;
	}

	// should be external
	function matchOrders(
		IexecODBLibOrders_v4.AppOrder        memory _apporder,
		IexecODBLibOrders_v4.DatasetOrder    memory _datasetorder,
		IexecODBLibOrders_v4.WorkerpoolOrder memory _workerpoolorder,
		IexecODBLibOrders_v4.RequestOrder    memory _requestorder)
	public returns (bytes32)
	{
		/**
		 * Check orders compatibility
		 */

		// computation environment & allowed enough funds
		require(_requestorder.category           == _workerpoolorder.category       );
		require(_requestorder.trust              <= _workerpoolorder.trust          );
		require(_requestorder.appmaxprice        >= _apporder.appprice              );
		require(_requestorder.datasetmaxprice    >= _datasetorder.datasetprice      );
		require(_requestorder.workerpoolmaxprice >= _workerpoolorder.workerpoolprice);
		require((_apporder.tag | _datasetorder.tag | _requestorder.tag) & ~_workerpoolorder.tag == 0x0);

		// Check matching and restrictions
		require(_requestorder.app     == _apporder.app        );
		require(_requestorder.dataset == _datasetorder.dataset);
		require(_requestorder.workerpool           == address(0) || _checkIdentity(_requestorder.workerpool,           _workerpoolorder.workerpool, GROUPMEMBER_PURPOSE)); // requestorder.workerpool is a restriction
		require(_apporder.datasetrestrict          == address(0) || _checkIdentity(_apporder.datasetrestrict,          _datasetorder.dataset,       GROUPMEMBER_PURPOSE));
		require(_apporder.workerpoolrestrict       == address(0) || _checkIdentity(_apporder.workerpoolrestrict,       _workerpoolorder.workerpool, GROUPMEMBER_PURPOSE));
		require(_apporder.requesterrestrict        == address(0) || _checkIdentity(_apporder.requesterrestrict,        _requestorder.requester,     GROUPMEMBER_PURPOSE));
		require(_datasetorder.apprestrict          == address(0) || _checkIdentity(_datasetorder.apprestrict,          _apporder.app,               GROUPMEMBER_PURPOSE));
		require(_datasetorder.workerpoolrestrict   == address(0) || _checkIdentity(_datasetorder.workerpoolrestrict,   _workerpoolorder.workerpool, GROUPMEMBER_PURPOSE));
		require(_datasetorder.requesterrestrict    == address(0) || _checkIdentity(_datasetorder.requesterrestrict,    _requestorder.requester,     GROUPMEMBER_PURPOSE));
		require(_workerpoolorder.apprestrict       == address(0) || _checkIdentity(_workerpoolorder.apprestrict,       _apporder.app,               GROUPMEMBER_PURPOSE));
		require(_workerpoolorder.datasetrestrict   == address(0) || _checkIdentity(_workerpoolorder.datasetrestrict,   _datasetorder.dataset,       GROUPMEMBER_PURPOSE));
		require(_workerpoolorder.requesterrestrict == address(0) || _checkIdentity(_workerpoolorder.requesterrestrict, _requestorder.requester,     GROUPMEMBER_PURPOSE));

		/**
		 * Check orders authenticity
		 */
		Identities memory ids;
		ids.hasDataset = _datasetorder.dataset != address(0);

		// app
		ids.appHash  = _apporder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		ids.appOwner = App(_apporder.app).owner();

		require(m_appregistry.isRegistered(_apporder.app));
		require(_checkPresignatureOrSignature(ids.appOwner, ids.appHash, _apporder.sign));

		// dataset
		if (ids.hasDataset) // only check if dataset is enabled
		{
			ids.datasetHash  = _datasetorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
			ids.datasetOwner = Dataset(_datasetorder.dataset).owner();

			require(m_datasetregistry.isRegistered(_datasetorder.dataset));
			require(_checkPresignatureOrSignature(ids.datasetOwner, ids.datasetHash, _datasetorder.sign));
		}

		// workerpool
		ids.workerpoolHash  = _workerpoolorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		ids.workerpoolOwner = Workerpool(_workerpoolorder.workerpool).owner();

		require(m_workerpoolregistry.isRegistered(_workerpoolorder.workerpool));
		require(_checkPresignatureOrSignature(ids.workerpoolOwner, ids.workerpoolHash, _workerpoolorder.sign));

		// request
		ids.requestHash = _requestorder.hash().toEthTypedStructHash(EIP712DOMAIN_SEPARATOR);
		require(_checkPresignatureOrSignature(_requestorder.requester, ids.requestHash, _requestorder.sign));

		/**
		 * Check availability
		 */
		uint256 volume;
		volume =                             _apporder.volume.sub       (m_consumed[ids.appHash       ]);
		volume = ids.hasDataset ? volume.min(_datasetorder.volume.sub   (m_consumed[ids.datasetHash   ])) : volume;
		volume =                  volume.min(_workerpoolorder.volume.sub(m_consumed[ids.workerpoolHash]));
		volume =                  volume.min(_requestorder.volume.sub   (m_consumed[ids.requestHash   ]));
		require(volume > 0);

		/**
		 * Record
		 */
		bytes32 dealid = keccak256(abi.encodePacked(
			ids.requestHash,            // requestHash
			m_consumed[ids.requestHash] // idx of first subtask
		));

		IexecODBLibCore_v4.Deal storage deal = m_deals[dealid];
		deal.app.pointer          = _apporder.app;
		deal.app.owner            = ids.appOwner;
		deal.app.price            = _apporder.appprice;
		deal.dataset.owner        = ids.datasetOwner;
		deal.dataset.pointer      = _datasetorder.dataset;
		deal.dataset.price        = ids.hasDataset ? _datasetorder.datasetprice : 0;
		deal.workerpool.pointer   = _workerpoolorder.workerpool;
		deal.workerpool.owner     = ids.workerpoolOwner;
		deal.workerpool.price     = _workerpoolorder.workerpoolprice;
		deal.trust                = _requestorder.trust.max(1);
		deal.category             = _requestorder.category;
		deal.tag                  = _apporder.tag | _datasetorder.tag | _requestorder.tag;
		deal.requester            = _requestorder.requester;
		deal.beneficiary          = _requestorder.beneficiary;
		deal.callback             = _requestorder.callback;
		deal.params               = _requestorder.params;
		deal.startTime            = now;
		deal.botFirst             = m_consumed[ids.requestHash];
		deal.botSize              = volume;
		deal.workerStake          = _workerpoolorder.workerpoolprice.percentage(Workerpool(_workerpoolorder.workerpool).m_workerStakeRatioPolicy());
		deal.schedulerRewardRatio = Workerpool(_workerpoolorder.workerpool).m_schedulerRewardRatioPolicy();

		/**
		 * Update consumed
		 */
		m_consumed[ids.appHash       ] = m_consumed[ids.appHash       ].add(                 volume    );
		m_consumed[ids.datasetHash   ] = m_consumed[ids.datasetHash   ].add(ids.hasDataset ? volume : 0);
		m_consumed[ids.workerpoolHash] = m_consumed[ids.workerpoolHash].add(                 volume    );
		m_consumed[ids.requestHash   ] = m_consumed[ids.requestHash   ].add(                 volume    );

		/**
		 * Lock
		 */
		lock(
			deal.requester,
			deal.app.price
			.add(deal.dataset.price)
			.add(deal.workerpool.price)
			.mul(volume)
		);
		lock(
			deal.workerpool.owner,
			deal.workerpool.price
			.percentage(WORKERPOOL_STAKE_RATIO) // ORDER IS IMPORTANT HERE!
			.mul(volume)                        // ORDER IS IMPORTANT HERE!
		);

		/**
		 * Advertize deal
		 */
		emit SchedulerNotice(deal.workerpool.pointer, dealid);

		/**
		 * Advertize consumption
		 */
		emit OrdersMatched(
			dealid,
			ids.appHash,
			ids.datasetHash,
			ids.workerpoolHash,
			ids.requestHash,
			volume
		);

		return dealid;
	}

	/***************************************************************************
	 *                            Consensus methods                            *
	 ***************************************************************************/
	function initialize(bytes32 _dealid, uint256 idx)
	public returns (bytes32)
	{
		IexecODBLibCore_v4.Deal memory deal = m_deals[_dealid];

		require(idx >= deal.botFirst                  );
		require(idx <  deal.botFirst.add(deal.botSize));

		bytes32 taskid  = keccak256(abi.encodePacked(_dealid, idx));
		IexecODBLibCore_v4.Task storage task = m_tasks[taskid];
		require(task.status == IexecODBLibCore_v4.TaskStatusEnum.UNSET);

		task.status               = IexecODBLibCore_v4.TaskStatusEnum.ACTIVE;
		task.dealid               = _dealid;
		task.idx                  = idx;
		task.timeref              = m_categories[deal.category].workClockTimeRef;
		task.contributionDeadline = task.timeref.mul(CONTRIBUTION_DEADLINE_RATIO).add(deal.startTime);
		task.finalDeadline        = task.timeref.mul(       FINAL_DEADLINE_RATIO).add(deal.startTime);

		// setup denominator
		m_totalweight[taskid] = 1;

		emit TaskInitialize(taskid, deal.workerpool.pointer);

		return taskid;
	}

	// TODO: making it external causes "stack too deep" error
	function contribute(
		bytes32      _taskid,
		bytes32      _resultHash,
		bytes32      _resultSeal,
		address      _enclaveChallenge,
		bytes memory _enclaveSign,
		bytes memory _workerpoolSign)
	public
	{
		IexecODBLibCore_v4.Task         storage task         = m_tasks[_taskid];
		IexecODBLibCore_v4.Contribution storage contribution = m_contributions[_taskid][msg.sender];
		IexecODBLibCore_v4.Deal         memory  deal         = m_deals[task.dealid];

		require(task.status               == IexecODBLibCore_v4.TaskStatusEnum.ACTIVE       );
		require(task.contributionDeadline >  now                                            );
		require(contribution.status       == IexecODBLibCore_v4.ContributionStatusEnum.UNSET);

		// Check that the worker + taskid + enclave combo is authorized to contribute (scheduler signature)
		require(_checkSignature(
			deal.workerpool.owner,
			keccak256(abi.encodePacked(
				msg.sender,
				_taskid,
				_enclaveChallenge
			)).toEthSignedMessageHash(),
			_workerpoolSign
		));

		// need enclave challenge if tag is set
		require(_enclaveChallenge != address(0) || (deal.tag[31] & 0x01 == 0));

		// Check enclave signature
		require(_enclaveChallenge == address(0) || _checkSignature(
			_enclaveChallenge,
			keccak256(abi.encodePacked(
				_resultHash,
				_resultSeal
			)).toEthSignedMessageHash(),
			_enclaveSign
		));

		// Update contribution entry
		contribution.status           = IexecODBLibCore_v4.ContributionStatusEnum.CONTRIBUTED;
		contribution.resultHash       = _resultHash;
		contribution.resultSeal       = _resultSeal;
		contribution.enclaveChallenge = _enclaveChallenge;
		task.contributors.push(msg.sender);

		lockContribution(task.dealid, msg.sender);

		emit TaskContribute(_taskid, msg.sender, _resultHash);

		// Contribution done → updating and checking concensus

		/*************************************************************************
		 *                           SCORE POLICY 1/3                            *
		 *                                                                       *
		 *                          see documentation!                           *
		 *************************************************************************/
		// k = 3
		uint256 weight = m_workerScores[msg.sender].div(3).max(3).sub(1);
		uint256 group  = m_groupweight[_taskid][_resultHash];
		uint256 delta  = group.max(1).mul(weight).sub(group);

		m_logweight  [_taskid][msg.sender ] = weight.log();
		m_groupweight[_taskid][_resultHash] = m_groupweight[_taskid][_resultHash].add(delta);
		m_totalweight[_taskid]              = m_totalweight[_taskid].add(delta);

		// Check consensus
		checkConsensus(_taskid, _resultHash);
	}

	function reveal(
		bytes32 _taskid,
		bytes32 _resultDigest)
	external // worker
	{
		IexecODBLibCore_v4.Task         storage task         = m_tasks[_taskid];
		IexecODBLibCore_v4.Contribution storage contribution = m_contributions[_taskid][msg.sender];
		require(task.status             == IexecODBLibCore_v4.TaskStatusEnum.REVEALING                    );
		require(task.revealDeadline     >  now                                                            );
		require(contribution.status     == IexecODBLibCore_v4.ContributionStatusEnum.CONTRIBUTED          );
		require(contribution.resultHash == task.consensusValue                                            );
		require(contribution.resultHash == keccak256(abi.encodePacked(            _taskid, _resultDigest)));
		require(contribution.resultSeal == keccak256(abi.encodePacked(msg.sender, _taskid, _resultDigest)));

		contribution.status = IexecODBLibCore_v4.ContributionStatusEnum.PROVED;
		task.revealCounter  = task.revealCounter.add(1);
		task.resultDigest   = _resultDigest;

		emit TaskReveal(_taskid, msg.sender, _resultDigest);
	}

	function reopen(
		bytes32 _taskid)
	external onlyScheduler(_taskid)
	{
		IexecODBLibCore_v4.Task storage task = m_tasks[_taskid];
		require(task.status         == IexecODBLibCore_v4.TaskStatusEnum.REVEALING);
		require(task.finalDeadline  >  now                                        );
		require(task.revealDeadline <= now
		     && task.revealCounter  == 0                                          );

		for (uint256 i = 0; i < task.contributors.length; ++i)
		{
			address worker = task.contributors[i];
			if (m_contributions[_taskid][worker].resultHash == task.consensusValue)
			{
				m_contributions[_taskid][worker].status = IexecODBLibCore_v4.ContributionStatusEnum.REJECTED;
			}
		}

		m_totalweight[_taskid]                      = m_totalweight[_taskid].sub(m_groupweight[_taskid][task.consensusValue]);
		m_groupweight[_taskid][task.consensusValue] = 0;

		task.status         = IexecODBLibCore_v4.TaskStatusEnum.ACTIVE;
		task.consensusValue = 0x0;
		task.revealDeadline = 0;
		task.winnerCounter  = 0;

		emit TaskReopen(_taskid);
	}

	function finalize(
		bytes32          _taskid,
		bytes   calldata _results)
	external onlyScheduler(_taskid)
	{
		IexecODBLibCore_v4.Task storage task = m_tasks[_taskid];
		require(task.status        == IexecODBLibCore_v4.TaskStatusEnum.REVEALING);
		require(task.finalDeadline >  now                                        );
		require(task.revealCounter == task.winnerCounter
		    || (task.revealCounter >  0  && task.revealDeadline <= now)          );

		task.status  = IexecODBLibCore_v4.TaskStatusEnum.COMPLETED;
		task.results = _results;

		/**
		 * Stake and reward management
		 */
		successWork(task.dealid, _taskid);
		distributeRewards(_taskid);

		/**
		 * Event
		 */
		emit TaskFinalize(_taskid, _results);

		executeCallback(_taskid, _results);
	}

	function claim(
		bytes32 _taskid)
	public
	{
		IexecODBLibCore_v4.Task storage task = m_tasks[_taskid];
		require(task.status == IexecODBLibCore_v4.TaskStatusEnum.ACTIVE
		     || task.status == IexecODBLibCore_v4.TaskStatusEnum.REVEALING);
		require(task.finalDeadline <= now);

		task.status = IexecODBLibCore_v4.TaskStatusEnum.FAILLED;

		/**
		 * Stake management
		 */
		failedWork(task.dealid, _taskid);
		for (uint256 i = 0; i < task.contributors.length; ++i)
		{
			address worker = task.contributors[i];
			unlockContribution(task.dealid, worker);
		}

		emit TaskClaimed(_taskid);
	}

	// New
	// TODO: making it external causes "stack too deep" error
	function contributeAndFinalize(
		bytes32      _taskid,
		bytes32      _resultDigest,
		bytes memory _results,
		address      _enclaveChallenge,
		bytes memory _enclaveSign,
		bytes memory _workerpoolSign)
	public
	{
		IexecODBLibCore_v4.Task         storage task         = m_tasks[_taskid];
		IexecODBLibCore_v4.Contribution storage contribution = m_contributions[_taskid][msg.sender];
		IexecODBLibCore_v4.Deal         memory  deal         = m_deals[task.dealid];

		require(task.status               == IexecODBLibCore_v4.TaskStatusEnum.ACTIVE);
		require(task.contributionDeadline >  now                                     );
		require(task.contributors.length  == 0                                       );
		require(deal.trust                == 1                                       ); // TODO, consider sender's score ?

		bytes32 resultHash = keccak256(abi.encodePacked(            _taskid, _resultDigest));
		bytes32 resultSeal = keccak256(abi.encodePacked(msg.sender, _taskid, _resultDigest));

		// Check that the worker + taskid + enclave combo is authorized to contribute (scheduler signature)
		require(_checkSignature(
			deal.workerpool.owner,
			keccak256(abi.encodePacked(
				msg.sender,
				_taskid,
				_enclaveChallenge
			)).toEthSignedMessageHash(),
			_workerpoolSign
		));

		// need enclave challenge if tag is set
		require(_enclaveChallenge != address(0) || (deal.tag[31] & 0x01 == 0));

		// Check enclave signature
		require(_enclaveChallenge == address(0) || _checkSignature(
			_enclaveChallenge,
			keccak256(abi.encodePacked(
				resultHash,
				resultSeal
			)).toEthSignedMessageHash(),
			_enclaveSign
		));

		contribution.status           = IexecODBLibCore_v4.ContributionStatusEnum.PROVED;
		contribution.resultHash       = resultHash;
		contribution.resultSeal       = resultSeal;
		contribution.enclaveChallenge = _enclaveChallenge;

		task.status                   = IexecODBLibCore_v4.TaskStatusEnum.COMPLETED;
		task.consensusValue           = contribution.resultHash;
		task.revealDeadline           = task.timeref.mul(REVEAL_DEADLINE_RATIO).add(now);
		task.revealCounter            = 1;
		task.winnerCounter            = 1;
		task.resultDigest             = _resultDigest;
		task.results                  = _results;
		task.contributors.push(msg.sender);

		successWork(task.dealid, _taskid);

		// simple reward, no score consideration
		uint256 workerReward    = deal.workerpool.price.percentage(uint256(100).sub(deal.schedulerRewardRatio));
		uint256 schedulerReward = deal.workerpool.price.sub(workerReward);
		rewardForContribution(msg.sender, workerReward, _taskid);
		rewardForScheduling(task.dealid, schedulerReward, _taskid);

		emit TaskContribute(_taskid, msg.sender, resultHash);
		emit TaskConsensus(_taskid, resultHash);
		emit TaskReveal(_taskid, msg.sender, _resultDigest);
		emit TaskFinalize(_taskid, _results);

		executeCallback(_taskid, _results);
	}

	/***************************************************************************
	 *                       Internal Consensus methods                        *
	 ***************************************************************************/
	/*
	 * Consensus detection
	 */
	function checkConsensus(
		bytes32 _taskid,
		bytes32 _consensus)
	internal
	{
		uint256 trust = m_deals[m_tasks[_taskid].dealid].trust;
		if (m_groupweight[_taskid][_consensus].mul(trust) > m_totalweight[_taskid].mul(trust.sub(1)))
		{
			// Preliminary checks done in "contribute()"

			IexecODBLibCore_v4.Task storage task = m_tasks[_taskid];
			uint256 winnerCounter = 0;
			for (uint256 i = 0; i < task.contributors.length; ++i)
			{
				address w = task.contributors[i];
				if
				(
					m_contributions[_taskid][w].resultHash == _consensus
					&&
					m_contributions[_taskid][w].status == IexecODBLibCore_v4.ContributionStatusEnum.CONTRIBUTED // REJECTED contribution must not be count
				)
				{
					winnerCounter = winnerCounter.add(1);
				}
			}
			// msg.sender is a contributor: no need to check
			// require(winnerCounter > 0);
			task.status         = IexecODBLibCore_v4.TaskStatusEnum.REVEALING;
			task.consensusValue = _consensus;
			task.revealDeadline = task.timeref.mul(REVEAL_DEADLINE_RATIO).add(now);
			task.revealCounter  = 0;
			task.winnerCounter  = winnerCounter;

			emit TaskConsensus(_taskid, _consensus);
		}
	}

	/*
	 * Reward distribution
	 */
	function distributeRewards(bytes32 _taskid)
	internal
	{
		IexecODBLibCore_v4.Task storage task = m_tasks[_taskid];
		IexecODBLibCore_v4.Deal memory  deal = m_deals[task.dealid];

		uint256 i;
		address worker;

		uint256 totalLogWeight = 0;
		uint256 totalReward = deal.workerpool.price;

		for (i = 0; i < task.contributors.length; ++i)
		{
			worker = task.contributors[i];
			if (m_contributions[_taskid][worker].status == IexecODBLibCore_v4.ContributionStatusEnum.PROVED)
			{
				totalLogWeight = totalLogWeight.add(m_logweight[_taskid][worker]);
			}
			else // ContributionStatusEnum.REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				totalReward = totalReward.add(deal.workerStake);
			}
		}

		// compute how much is going to the workers
		uint256 workersReward = totalReward.percentage(uint256(100).sub(deal.schedulerRewardRatio));

		for (i = 0; i < task.contributors.length; ++i)
		{
			worker = task.contributors[i];
			if (m_contributions[_taskid][worker].status == IexecODBLibCore_v4.ContributionStatusEnum.PROVED)
			{
				uint256 workerReward = workersReward.mulByFraction(m_logweight[_taskid][worker], totalLogWeight);
				totalReward          = totalReward.sub(workerReward);

				unlockContribution(task.dealid, worker);
				rewardForContribution(worker, workerReward, _taskid);

				// Only reward if replication happened
				if (task.contributors.length > 1)
				{
					/*******************************************************************
					 *                        SCORE POLICY 2/3                         *
					 *                                                                 *
					 *                       see documentation!                        *
					 *******************************************************************/
					m_workerScores[worker] = m_workerScores[worker].add(1);
					emit AccurateContribution(worker, _taskid);
				}
			}
			else // WorkStatusEnum.POCO_REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				// No Reward
				seizeContribution(task.dealid, worker, _taskid);

				// Always punish bad contributors
				{
					/*******************************************************************
					 *                        SCORE POLICY 3/3                         *
					 *                                                                 *
					 *                       see documentation!                        *
					 *******************************************************************/
					// k = 3
					m_workerScores[worker] = m_workerScores[worker].mulByFraction(2,3);
					emit FaultyContribution(worker, _taskid);
				}
			}
		}
		// totalReward now contains the scheduler share
		rewardForScheduling(task.dealid, totalReward, _taskid);
	}

	/**
	 * Callback for smartcontracts using EIP1154
	 */
	function executeCallback(bytes32 _taskid, bytes memory _results)
	internal
	{
		address target = m_deals[m_tasks[_taskid].dealid].callback;
		if (target != address(0))
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
			bool success;
			(success,) = target.call.gas(100000)(abi.encodeWithSignature(
				"receiveResult(bytes32,bytes)",
				_taskid,
				_results
			));
		}
	}

	/***************************************************************************
	 *                            Array operations                             *
	 ***************************************************************************/
	function initializeArray(
		bytes32[] calldata _dealid,
		uint256[] calldata _idx)
	external returns (bool)
	{
		require(_dealid.length == _idx.length);
		for (uint i = 0; i < _dealid.length; ++i)
		{
			initialize(_dealid[i], _idx[i]);
		}
		return true;
	}

	function claimArray(
		bytes32[] calldata _taskid)
	external returns (bool)
	{
		for (uint i = 0; i < _taskid.length; ++i)
		{
			claim(_taskid[i]);
		}
		return true;
	}

	function initializeAndClaimArray(
		bytes32[] calldata _dealid,
		uint256[] calldata _idx)
	external returns (bool)
	{
		require(_dealid.length == _idx.length);
		for (uint i = 0; i < _dealid.length; ++i)
		{
			claim(initialize(_dealid[i], _idx[i]));
		}
		return true;
	}
}
