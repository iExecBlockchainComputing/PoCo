// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@iexec/solidity/contracts/ERC1154/IERC1154.sol";
import "./IexecERC20Common.sol";
import "./SignatureVerifier.sol";
import "../DelegateBase.sol";
import "../interfaces/IexecPoco.sol";


struct Matching
{
	bytes   apporderStruct;
	bytes32 apporderHash;
	address appOwner;
	bytes   datasetorderStruct;
	bytes32 datasetorderHash;
	address datasetOwner;
	bytes   workerpoolorderStruct;
	bytes32 workerpoolorderHash;
	address workerpoolOwner;
	bytes   requestorderStruct;
	bytes32 requestorderHash;
	bool    hasDataset;
}

contract IexecPocoDelegate is IexecPoco, DelegateBase, IexecERC20Common, SignatureVerifier
{
	using SafeMathExtended  for uint256;
	using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
	using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
	using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
	using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

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
		IexecLibCore_v5.Deal storage deal = m_deals[_dealid];

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
		IexecLibCore_v5.Deal memory deal = m_deals[_dealid];

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
	external view override returns (bool)
	{
		return _checkSignature(_identity, _hash, _signature);
	}

	function verifyPresignature(address _identity, bytes32 _hash)
	external view override returns (bool)
	{
		return _checkPresignature(_identity, _hash);
	}

	function verifyPresignatureOrSignature(address _identity, bytes32 _hash, bytes calldata _signature)
	external view override returns (bool)
	{
		return _checkPresignatureOrSignature(_identity, _hash, _signature);
	}

	/***************************************************************************
	 *                           ODB order matching                            *
	 ***************************************************************************/
	// should be external
	function matchOrders(
		IexecLibOrders_v5.AppOrder        memory _apporder,
		IexecLibOrders_v5.DatasetOrder    memory _datasetorder,
		IexecLibOrders_v5.WorkerpoolOrder memory _workerpoolorder,
		IexecLibOrders_v5.RequestOrder    memory _requestorder)
	public override returns (bytes32)
	{
		/**
		 * Check orders compatibility
		 */

		// computation environment & allowed enough funds
		bytes32 tag = _apporder.tag | _datasetorder.tag | _requestorder.tag;
		require(_requestorder.category           == _workerpoolorder.category,        'iExecV5-matchOrders-0x00');
		require(_requestorder.category            < m_categories.length,              'iExecV5-matchOrders-0x01');
		require(_requestorder.trust              <= _workerpoolorder.trust,           'iExecV5-matchOrders-0x02');
		require(_requestorder.appmaxprice        >= _apporder.appprice,               'iExecV5-matchOrders-0x03');
		require(_requestorder.datasetmaxprice    >= _datasetorder.datasetprice,       'iExecV5-matchOrders-0x04');
		require(_requestorder.workerpoolmaxprice >= _workerpoolorder.workerpoolprice, 'iExecV5-matchOrders-0x05');
		require(tag & ~_workerpoolorder.tag      == 0x0,                              'iExecV5-matchOrders-0x06');
		require((tag ^ _apporder.tag)[31] & 0x01 == 0x0,                              'iExecV5-matchOrders-0x07');

		// Check matching and restrictions
		require(_requestorder.app     == _apporder.app,                                                                                                                   'iExecV5-matchOrders-0x10');
		require(_requestorder.dataset == _datasetorder.dataset,                                                                                                           'iExecV5-matchOrders-0x11');
		require(_requestorder.workerpool           == address(0) || _checkIdentity(_requestorder.workerpool,           _workerpoolorder.workerpool, GROUPMEMBER_PURPOSE), 'iExecV5-matchOrders-0x12'); // requestorder.workerpool is a restriction
		require(_apporder.datasetrestrict          == address(0) || _checkIdentity(_apporder.datasetrestrict,          _datasetorder.dataset,       GROUPMEMBER_PURPOSE), 'iExecV5-matchOrders-0x13');
		require(_apporder.workerpoolrestrict       == address(0) || _checkIdentity(_apporder.workerpoolrestrict,       _workerpoolorder.workerpool, GROUPMEMBER_PURPOSE), 'iExecV5-matchOrders-0x14');
		require(_apporder.requesterrestrict        == address(0) || _checkIdentity(_apporder.requesterrestrict,        _requestorder.requester,     GROUPMEMBER_PURPOSE), 'iExecV5-matchOrders-0x15');
		require(_datasetorder.apprestrict          == address(0) || _checkIdentity(_datasetorder.apprestrict,          _apporder.app,               GROUPMEMBER_PURPOSE), 'iExecV5-matchOrders-0x16');
		require(_datasetorder.workerpoolrestrict   == address(0) || _checkIdentity(_datasetorder.workerpoolrestrict,   _workerpoolorder.workerpool, GROUPMEMBER_PURPOSE), 'iExecV5-matchOrders-0x17');
		require(_datasetorder.requesterrestrict    == address(0) || _checkIdentity(_datasetorder.requesterrestrict,    _requestorder.requester,     GROUPMEMBER_PURPOSE), 'iExecV5-matchOrders-0x18');
		require(_workerpoolorder.apprestrict       == address(0) || _checkIdentity(_workerpoolorder.apprestrict,       _apporder.app,               GROUPMEMBER_PURPOSE), 'iExecV5-matchOrders-0x19');
		require(_workerpoolorder.datasetrestrict   == address(0) || _checkIdentity(_workerpoolorder.datasetrestrict,   _datasetorder.dataset,       GROUPMEMBER_PURPOSE), 'iExecV5-matchOrders-0x1a');
		require(_workerpoolorder.requesterrestrict == address(0) || _checkIdentity(_workerpoolorder.requesterrestrict, _requestorder.requester,     GROUPMEMBER_PURPOSE), 'iExecV5-matchOrders-0x1b');

		/**
		 * Check orders authenticity
		 */
		Matching memory ids;
		ids.hasDataset = _datasetorder.dataset != address(0);

		// app
		ids.apporderStruct = _toEthTypedStruct(_apporder.hash(), EIP712DOMAIN_SEPARATOR);
		ids.apporderHash   = keccak256(ids.apporderStruct);
		ids.appOwner       = App(_apporder.app).owner();

		require(m_appregistry.isRegistered(_apporder.app),                                       'iExecV5-matchOrders-0x20');
		require(_checkPresignatureOrSignature(ids.appOwner, ids.apporderStruct, _apporder.sign), 'iExecV5-matchOrders-0x21');

		// dataset
		if (ids.hasDataset) // only check if dataset is enabled
		{
			ids.datasetorderStruct = _toEthTypedStruct(_datasetorder.hash(), EIP712DOMAIN_SEPARATOR);
			ids.datasetorderHash   = keccak256(ids.datasetorderStruct);
			ids.datasetOwner       = Dataset(_datasetorder.dataset).owner();

			require(m_datasetregistry.isRegistered(_datasetorder.dataset),                                       'iExecV5-matchOrders-0x30');
			require(_checkPresignatureOrSignature(ids.datasetOwner, ids.datasetorderStruct, _datasetorder.sign), 'iExecV5-matchOrders-0x31');
		}

		// workerpool
		ids.workerpoolorderStruct = _toEthTypedStruct(_workerpoolorder.hash(), EIP712DOMAIN_SEPARATOR);
		ids.workerpoolorderHash   = keccak256(ids.workerpoolorderStruct);
		ids.workerpoolOwner       = Workerpool(_workerpoolorder.workerpool).owner();

		require(m_workerpoolregistry.isRegistered(_workerpoolorder.workerpool),                                       'iExecV5-matchOrders-0x40');
		require(_checkPresignatureOrSignature(ids.workerpoolOwner, ids.workerpoolorderStruct, _workerpoolorder.sign), 'iExecV5-matchOrders-0x41');

		// request
		ids.requestorderStruct = _toEthTypedStruct(_requestorder.hash(), EIP712DOMAIN_SEPARATOR);
		ids.requestorderHash   = keccak256(ids.requestorderStruct);
		require(_checkPresignatureOrSignature(_requestorder.requester, ids.requestorderStruct, _requestorder.sign), 'iExecV5-matchOrders-0x50');

		/**
		 * Check availability
		 */
		uint256 volume;
		volume =                             _apporder.volume.sub       (m_consumed[ids.apporderHash       ]);
		volume = ids.hasDataset ? volume.min(_datasetorder.volume.sub   (m_consumed[ids.datasetorderHash   ])) : volume;
		volume =                  volume.min(_workerpoolorder.volume.sub(m_consumed[ids.workerpoolorderHash]));
		volume =                  volume.min(_requestorder.volume.sub   (m_consumed[ids.requestorderHash   ]));
		require(volume > 0, 'iExecV5-matchOrders-0x60');

		/**
		 * Record
		 */
		bytes32 dealid = keccak256(abi.encodePacked(
			ids.requestorderHash,            // requestHash
			m_consumed[ids.requestorderHash] // idx of first subtask
		));

		IexecLibCore_v5.Deal storage deal = m_deals[dealid];
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
		deal.tag                  = tag;
		deal.requester            = _requestorder.requester;
		deal.beneficiary          = _requestorder.beneficiary;
		deal.callback             = _requestorder.callback;
		deal.params               = _requestorder.params;
		deal.startTime            = now;
		deal.botFirst             = m_consumed[ids.requestorderHash];
		deal.botSize              = volume;
		deal.workerStake          = _workerpoolorder.workerpoolprice.percentage(Workerpool(_workerpoolorder.workerpool).m_workerStakeRatioPolicy());
		deal.schedulerRewardRatio = Workerpool(_workerpoolorder.workerpool).m_schedulerRewardRatioPolicy();

		/**
		 * Update consumed
		 */
		m_consumed[ids.apporderHash       ] = m_consumed[ids.apporderHash       ].add(                 volume    );
		m_consumed[ids.datasetorderHash   ] = m_consumed[ids.datasetorderHash   ].add(ids.hasDataset ? volume : 0);
		m_consumed[ids.workerpoolorderHash] = m_consumed[ids.workerpoolorderHash].add(                 volume    );
		m_consumed[ids.requestorderHash   ] = m_consumed[ids.requestorderHash   ].add(                 volume    );

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
			dealid
		,	ids.apporderHash
		,	ids.datasetorderHash
		,	ids.workerpoolorderHash
		,	ids.requestorderHash
		,	volume
		);

		return dealid;
	}

	/***************************************************************************
	 *                            Consensus methods                            *
	 ***************************************************************************/
	function initialize(bytes32 _dealid, uint256 idx)
	public override returns (bytes32)
	{
		IexecLibCore_v5.Deal memory deal = m_deals[_dealid];

		require(idx >= deal.botFirst                  );
		require(idx <  deal.botFirst.add(deal.botSize));

		bytes32 taskid  = keccak256(abi.encodePacked(_dealid, idx));
		IexecLibCore_v5.Task storage task = m_tasks[taskid];
		require(task.status == IexecLibCore_v5.TaskStatusEnum.UNSET);

		task.status               = IexecLibCore_v5.TaskStatusEnum.ACTIVE;
		task.dealid               = _dealid;
		task.idx                  = idx;
		task.timeref              = m_categories[deal.category].workClockTimeRef;
		task.contributionDeadline = task.timeref.mul(CONTRIBUTION_DEADLINE_RATIO).add(deal.startTime);
		task.finalDeadline        = task.timeref.mul(       FINAL_DEADLINE_RATIO).add(deal.startTime);

		// setup denominator
		m_consensus[taskid].total = 1;

		emit TaskInitialize(taskid, deal.workerpool.pointer);

		return taskid;
	}

	// TODO / COMPILER ERROR: making it external causes "stack too deep" error
	function contribute(
		bytes32      _taskid,
		bytes32      _resultHash,
		bytes32      _resultSeal,
		address      _enclaveChallenge,
		bytes memory _enclaveSign,
		bytes memory _authorizationSign)
	public override
	{
		IexecLibCore_v5.Task         storage task         = m_tasks[_taskid];
		IexecLibCore_v5.Contribution storage contribution = m_contributions[_taskid][_msgSender()];
		IexecLibCore_v5.Deal         memory  deal         = m_deals[task.dealid];

		require(task.status               == IexecLibCore_v5.TaskStatusEnum.ACTIVE       );
		require(task.contributionDeadline >  now                                         );
		require(contribution.status       == IexecLibCore_v5.ContributionStatusEnum.UNSET);

		// need enclave challenge if tag is set
		require(_enclaveChallenge != address(0) || (deal.tag[31] & 0x01 == 0));

		// Check that the worker + taskid + enclave combo is authorized to contribute (scheduler signature)
		require(_checkSignature(
			( _enclaveChallenge != address(0) && m_teebroker != address(0) ) ? m_teebroker : deal.workerpool.owner,
			_toEthSignedMessage(keccak256(abi.encodePacked(
				_msgSender(),
				_taskid,
				_enclaveChallenge
			))),
			_authorizationSign
		));

		// Check enclave signature
		require(_enclaveChallenge == address(0) || _checkSignature(
			_enclaveChallenge,
			_toEthSignedMessage(keccak256(abi.encodePacked(
				_resultHash,
				_resultSeal
			))),
			_enclaveSign
		));

		// Update contribution entry
		contribution.status           = IexecLibCore_v5.ContributionStatusEnum.CONTRIBUTED;
		contribution.resultHash       = _resultHash;
		contribution.resultSeal       = _resultSeal;
		contribution.enclaveChallenge = _enclaveChallenge;
		task.contributors.push(_msgSender());

		lockContribution(task.dealid, _msgSender());

		emit TaskContribute(_taskid, _msgSender(), _resultHash);

		// Contribution done → updating and checking consensus

		/*************************************************************************
		 *                           SCORE POLICY 1/3                            *
		 *                                                                       *
		 *                          see documentation!                           *
		 *************************************************************************/
		// k = 3
		IexecLibCore_v5.Consensus storage consensus = m_consensus[_taskid];

		uint256 weight = m_workerScores[_msgSender()].div(3).max(3).sub(1);
		uint256 group  = consensus.group[_resultHash];
		uint256 delta  = group.max(1).mul(weight).sub(group);

		contribution.weight          = weight.log();
		consensus.group[_resultHash] = consensus.group[_resultHash].add(delta);
		consensus.total              = consensus.total.add(delta);

		// Check consensus
		checkConsensus(_taskid, _resultHash);
	}

	function reveal(
		bytes32 _taskid,
		bytes32 _resultDigest)
	external override // worker
	{
		IexecLibCore_v5.Task         storage task         = m_tasks[_taskid];
		IexecLibCore_v5.Contribution storage contribution = m_contributions[_taskid][_msgSender()];
		require(task.status             == IexecLibCore_v5.TaskStatusEnum.REVEALING                         );
		require(task.revealDeadline     >  now                                                              );
		require(contribution.status     == IexecLibCore_v5.ContributionStatusEnum.CONTRIBUTED               );
		require(contribution.resultHash == task.consensusValue                                              );
		require(contribution.resultHash == keccak256(abi.encodePacked(              _taskid, _resultDigest)));
		require(contribution.resultSeal == keccak256(abi.encodePacked(_msgSender(), _taskid, _resultDigest)));

		contribution.status = IexecLibCore_v5.ContributionStatusEnum.PROVED;
		task.revealCounter  = task.revealCounter.add(1);
		task.resultDigest   = _resultDigest;

		emit TaskReveal(_taskid, _msgSender(), _resultDigest);
	}

	function reopen(
		bytes32 _taskid)
	external override onlyScheduler(_taskid)
	{
		IexecLibCore_v5.Task storage task = m_tasks[_taskid];
		require(task.status         == IexecLibCore_v5.TaskStatusEnum.REVEALING);
		require(task.finalDeadline  >  now                                     );
		require(task.revealDeadline <= now && task.revealCounter == 0          );

		for (uint256 i = 0; i < task.contributors.length; ++i)
		{
			address worker = task.contributors[i];
			if (m_contributions[_taskid][worker].resultHash == task.consensusValue)
			{
				m_contributions[_taskid][worker].status = IexecLibCore_v5.ContributionStatusEnum.REJECTED;
			}
		}

		IexecLibCore_v5.Consensus storage consensus = m_consensus[_taskid];
		consensus.total = consensus.total.sub(consensus.group[task.consensusValue]);
		consensus.group[task.consensusValue] = 0;

		task.status         = IexecLibCore_v5.TaskStatusEnum.ACTIVE;
		task.consensusValue = 0x0;
		task.revealDeadline = 0;
		task.winnerCounter  = 0;

		emit TaskReopen(_taskid);
	}

	function finalize(
		bytes32          _taskid,
		bytes   calldata _results,
		bytes   calldata _resultsCallback) // Expansion - result separation
	external override onlyScheduler(_taskid)
	{
		IexecLibCore_v5.Task storage task = m_tasks[_taskid];
		IexecLibCore_v5.Deal memory  deal = m_deals[task.dealid];

		require(task.status        == IexecLibCore_v5.TaskStatusEnum.REVEALING                                    );
		require(task.finalDeadline >  now                                                                         );
		require(task.revealCounter == task.winnerCounter || (task.revealCounter > 0 && task.revealDeadline <= now));

		require((deal.callback == address(0) && _resultsCallback.length == 0) || keccak256(_resultsCallback) == task.resultDigest);

		task.status          = IexecLibCore_v5.TaskStatusEnum.COMPLETED;
		task.results         = _results;
		task.resultsCallback = _resultsCallback; // Expansion - result separation

		/**
		 * Stake and reward management
		 */
		successWork(task.dealid, _taskid);
		distributeRewards(_taskid);

		/**
		 * Event
		 */
		emit TaskFinalize(_taskid, _results);

		executeCallback(_taskid, _resultsCallback);
	}

	function claim(
		bytes32 _taskid)
	public override
	{
		IexecLibCore_v5.Task storage task = m_tasks[_taskid];
		require(task.status == IexecLibCore_v5.TaskStatusEnum.ACTIVE
		     || task.status == IexecLibCore_v5.TaskStatusEnum.REVEALING);
		require(task.finalDeadline <= now);

		task.status = IexecLibCore_v5.TaskStatusEnum.FAILED;

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

	// TODO / COMPILER ERROR: making it external causes "stack too deep" error
	function contributeAndFinalize(
		bytes32      _taskid,
		bytes32      _resultDigest,
		bytes memory _results,
		bytes memory _resultsCallback, // Expansion - result separation
		address      _enclaveChallenge,
		bytes memory _enclaveSign,
		bytes memory _authorizationSign)
	public override
	{
		IexecLibCore_v5.Task         storage task         = m_tasks[_taskid];
		IexecLibCore_v5.Contribution storage contribution = m_contributions[_taskid][_msgSender()];
		IexecLibCore_v5.Deal         memory  deal         = m_deals[task.dealid];

		require(task.status               == IexecLibCore_v5.TaskStatusEnum.ACTIVE);
		require(task.contributionDeadline >  now                                  );
		require(task.contributors.length  == 0                                    );
		require(deal.trust                == 1                                    ); // TODO / FUTURE FEATURE: consider sender's score ?

		bytes32 resultHash = keccak256(abi.encodePacked(              _taskid, _resultDigest));
		bytes32 resultSeal = keccak256(abi.encodePacked(_msgSender(), _taskid, _resultDigest));

		require((deal.callback == address(0) && _resultsCallback.length == 0) || keccak256(_resultsCallback) == task.resultDigest);

		// need enclave challenge if tag is set
		require(_enclaveChallenge != address(0) || (deal.tag[31] & 0x01 == 0));

		// Check that the worker + taskid + enclave combo is authorized to contribute (scheduler signature)
		require(_checkSignature(
			( _enclaveChallenge != address(0) && m_teebroker != address(0) ) ? m_teebroker : deal.workerpool.owner,
			_toEthSignedMessage(keccak256(abi.encodePacked(
				_msgSender(),
				_taskid,
				_enclaveChallenge
			))),
			_authorizationSign
		));

		// Check enclave signature
		require(_enclaveChallenge == address(0) || _checkSignature(
			_enclaveChallenge,
			_toEthSignedMessage(keccak256(abi.encodePacked(
				resultHash,
				resultSeal
			))),
			_enclaveSign
		));

		contribution.status           = IexecLibCore_v5.ContributionStatusEnum.PROVED;
		contribution.resultHash       = resultHash;
		contribution.resultSeal       = resultSeal;
		contribution.enclaveChallenge = _enclaveChallenge;

		task.status                   = IexecLibCore_v5.TaskStatusEnum.COMPLETED;
		task.consensusValue           = contribution.resultHash;
		task.revealDeadline           = task.timeref.mul(REVEAL_DEADLINE_RATIO).add(now);
		task.revealCounter            = 1;
		task.winnerCounter            = 1;
		task.resultDigest             = _resultDigest;
		task.results                  = _results;
		task.resultsCallback          = _resultsCallback; // Expansion - result separation
		task.contributors.push(_msgSender());

		successWork(task.dealid, _taskid);
		distributeRewardsFast(_taskid);

		emit TaskContribute(_taskid, _msgSender(), resultHash);
		emit TaskConsensus(_taskid, resultHash);
		emit TaskReveal(_taskid, _msgSender(), _resultDigest);
		emit TaskFinalize(_taskid, _results);

		executeCallback(_taskid, _resultsCallback);
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
		IexecLibCore_v5.Task      storage task      = m_tasks[_taskid];
		IexecLibCore_v5.Consensus storage consensus = m_consensus[_taskid];

		uint256 trust = m_deals[task.dealid].trust;
		/*************************************************************************
		 *                          Consensus detection                          *
		 *                                                                       *
		 *                          see documentation:                           *
		 *          ./ audit/docs/iExec_PoCo_and_trustmanagement_v1.pdf          *
		 *************************************************************************/
		if (consensus.group[_consensus].mul(trust) > consensus.total.mul(trust.sub(1)))
		{
			// Preliminary checks done in "contribute()"
			uint256 winnerCounter = 0;
			for (uint256 i = 0; i < task.contributors.length; ++i)
			{
				address w = task.contributors[i];
				if
				(
					m_contributions[_taskid][w].resultHash == _consensus
					&&
					m_contributions[_taskid][w].status == IexecLibCore_v5.ContributionStatusEnum.CONTRIBUTED // REJECTED contribution must not be count
				)
				{
					winnerCounter = winnerCounter.add(1);
				}
			}
			// _msgSender() is a contributor: no need to check
			task.status         = IexecLibCore_v5.TaskStatusEnum.REVEALING;
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
		IexecLibCore_v5.Task memory task = m_tasks[_taskid];
		IexecLibCore_v5.Deal memory deal = m_deals[task.dealid];

		uint256 totalLogWeight = 0;
		uint256 totalReward    = deal.workerpool.price;

		for (uint256 i = 0; i < task.contributors.length; ++i)
		{
			address                              worker       = task.contributors[i];
			IexecLibCore_v5.Contribution storage contribution = m_contributions[_taskid][worker];

			if (contribution.status == IexecLibCore_v5.ContributionStatusEnum.PROVED)
			{
				totalLogWeight = totalLogWeight.add(contribution.weight);
			}
			else // ContributionStatusEnum.REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				totalReward = totalReward.add(deal.workerStake);
			}
		}

		// compute how much is going to the workers
		uint256 workersReward = totalReward.percentage(uint256(100).sub(deal.schedulerRewardRatio));

		for (uint256 i = 0; i < task.contributors.length; ++i)
		{
			address                              worker       = task.contributors[i];
			IexecLibCore_v5.Contribution storage contribution = m_contributions[_taskid][worker];

			if (contribution.status == IexecLibCore_v5.ContributionStatusEnum.PROVED)
			{
				uint256 workerReward = workersReward.mulByFraction(contribution.weight, totalLogWeight);
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

	/*
	 * Reward distribution for contributeAndFinalize
	 */
	function distributeRewardsFast(bytes32 _taskid)
	internal
	{
		IexecLibCore_v5.Task memory task = m_tasks[_taskid];
		IexecLibCore_v5.Deal memory deal = m_deals[task.dealid];

		// simple reward, no score consideration
		uint256 workerReward    = deal.workerpool.price.percentage(uint256(100).sub(deal.schedulerRewardRatio));
		uint256 schedulerReward = deal.workerpool.price.sub(workerReward);
		rewardForContribution(_msgSender(), workerReward, _taskid);
		rewardForScheduling(task.dealid, schedulerReward, _taskid);
	}

	/**
	 * Callback for smartcontracts using EIP1154
	 */
	function executeCallback(bytes32 _taskid, bytes memory _resultsCallback)
	internal
	{
		address target = m_deals[m_tasks[_taskid].dealid].callback;
		if (target != address(0))
		{
			// Solidity 0.6.0 reverts if target is not a smartcontracts
			// /**
			//  * Call does not revert if the target smart contract is incompatible or reverts
			//  * Solidity 0.6.0 update. Check hit history for 0.5.0 implementation.
			//  */
			// try IOracleConsumer(target).receiveResult{gas: m_callbackgas}(_taskid, _results)
			// {
			// 	// Callback success, do nothing
			// }
			// catch (bytes memory /*lowLevelData*/)
			// {
			// 	// Check gas: https://ronan.eth.link/blog/ethereum-gas-dangers/
			// 	assert(gasleft() > m_callbackgas / 63); // no need for safemath here
			// }

			// Pre solidity 0.6.0 version
			(bool success, bytes memory returndata) = target.call{gas: m_callbackgas}(abi.encodeWithSignature("receiveResult(bytes32,bytes)", _taskid, _resultsCallback));
			assert(gasleft() > m_callbackgas / 63);
			// silent unused variable warning
			success;
			returndata;
		}
	}

	/***************************************************************************
	 *                            Array operations                             *
	 ***************************************************************************/
	function initializeArray(
		bytes32[] calldata _dealid,
		uint256[] calldata _idx)
	external override returns (bool)
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
	external override returns (bool)
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
	external override returns (bool)
	{
		require(_dealid.length == _idx.length);
		for (uint i = 0; i < _dealid.length; ++i)
		{
			claim(initialize(_dealid[i], _idx[i]));
		}
		return true;
	}
}
