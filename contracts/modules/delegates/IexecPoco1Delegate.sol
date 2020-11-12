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

import "./IexecERC20Core.sol";
import "./SignatureVerifier.sol";
import "../DelegateBase.sol";
import "../interfaces/IexecPoco1.sol";


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

contract IexecPoco1Delegate is IexecPoco1, DelegateBase, IexecERC20Core, SignatureVerifier
{
	using SafeMathExtended  for uint256;
	using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
	using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
	using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
	using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

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
		require(_isAuthorized(ids.appOwner),                                                     'iExecV5-matchOrders-0x22');

		// dataset
		if (ids.hasDataset) // only check if dataset is enabled
		{
			ids.datasetorderStruct = _toEthTypedStruct(_datasetorder.hash(), EIP712DOMAIN_SEPARATOR);
			ids.datasetorderHash   = keccak256(ids.datasetorderStruct);
			ids.datasetOwner       = Dataset(_datasetorder.dataset).owner();

			require(m_datasetregistry.isRegistered(_datasetorder.dataset),                                       'iExecV5-matchOrders-0x30');
			require(_checkPresignatureOrSignature(ids.datasetOwner, ids.datasetorderStruct, _datasetorder.sign), 'iExecV5-matchOrders-0x31');
			require(_isAuthorized(ids.datasetOwner),                                                             'iExecV5-matchOrders-0x32');
		}

		// workerpool
		ids.workerpoolorderStruct = _toEthTypedStruct(_workerpoolorder.hash(), EIP712DOMAIN_SEPARATOR);
		ids.workerpoolorderHash   = keccak256(ids.workerpoolorderStruct);
		ids.workerpoolOwner       = Workerpool(_workerpoolorder.workerpool).owner();

		require(m_workerpoolregistry.isRegistered(_workerpoolorder.workerpool),                                       'iExecV5-matchOrders-0x40');
		require(_checkPresignatureOrSignature(ids.workerpoolOwner, ids.workerpoolorderStruct, _workerpoolorder.sign), 'iExecV5-matchOrders-0x41');
		require(_isAuthorized(ids.workerpoolOwner),                                                                   'iExecV5-matchOrders-0x42');

		// request
		ids.requestorderStruct = _toEthTypedStruct(_requestorder.hash(), EIP712DOMAIN_SEPARATOR);
		ids.requestorderHash   = keccak256(ids.requestorderStruct);
		require(_checkPresignatureOrSignature(_requestorder.requester, ids.requestorderStruct, _requestorder.sign), 'iExecV5-matchOrders-0x50');
		require(_isAuthorized(_requestorder.requester),                                                             'iExecV5-matchOrders-0x51');

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
}
