pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./tools/IexecODBLibCore.sol";
import "./tools/IexecODBLibOrders.sol";
import "./tools/SafeMathOZ.sol";

import "./Escrow.sol";
import "./IexecHubAccessor.sol";

import "./registries/Dapp.sol";
import "./registries/Data.sol";
import "./registries/Pool.sol";

import "./permissions/GroupInterface.sol";

contract IexecClerk is Escrow, IexecHubAccessor
{
	using SafeMathOZ for uint256;

	/***************************************************************************
	 *                                Constants                                *
	 ***************************************************************************/
	uint256 public constant POOL_STAKE_RATIO = 30;
	uint256 public constant KITTY_RATIO      = 10;
	uint256 public constant KITTY_MIN        = 1000;

	/***************************************************************************
	 *                               Clerk data                                *
	 ***************************************************************************/
	mapping(bytes32 => bytes32[]             ) public m_userdeals;
	mapping(bytes32 => IexecODBLibCore.Deal  ) public m_deals;
	mapping(bytes32 => IexecODBLibCore.Config) public m_configs;
	mapping(bytes32 => uint256               ) public m_consumed;
	mapping(bytes32 => bool                  ) public m_presigned;

	/***************************************************************************
	 *                                 Events                                  *
	 ***************************************************************************/
	event OrdersMatched  (bytes32 dealid,
	                      bytes32 dappHash,
	                      bytes32 dataHash,
	                      bytes32 poolHash,
	                      bytes32 userHash,
												uint256 volume);
	event ClosedDappOrder(bytes32 dappHash);
	event ClosedDataOrder(bytes32 dataHash);
	event ClosedPoolOrder(bytes32 poolHash);
	event ClosedUserOrder(bytes32 userHash);

	event SchedulerNotice(address indexed pool, bytes32 dealid);

	/***************************************************************************
	 *                               Constructor                               *
	 ***************************************************************************/
	constructor(
		address _rlctoken,
		address _iexechub)
	public
	Escrow(_rlctoken)
	IexecHubAccessor(_iexechub)
	{
	}

	/***************************************************************************
	 *                                Accessor                                 *
	 ***************************************************************************/
	function viewUserDeals(bytes32 _id)
	public view returns (bytes32[])
	{
		return m_userdeals[_id];
	}
	function viewDeal(bytes32 _id)
	public view returns (IexecODBLibCore.Deal)
	{
		return m_deals[_id];
	}

	function viewConfig(bytes32 _id)
	public view returns (IexecODBLibCore.Config)
	{
		return m_configs[_id];
	}

	function viewConsumed(bytes32 _id)
	public view returns (uint256)
	{
		return m_consumed[_id];
	}
	
	/***************************************************************************
	 *                         Enterprise restriction                          *
	 ***************************************************************************/
	/*
	function isContract(address addr)
	public view returns (bool)
	{
		assert(false);
		uint size;
		assembly { size := extcodesize(addr) }
		return size > 0;
	}
	*/

	// Fails fail for wrong simple addresses
	function checkRestriction(address _restriction, address _candidate, bytes1 _mask)
	public view returns (bool)
	{
		return _restriction == address(0) // No restriction
		    || _restriction == _candidate // Simple address
		    || GroupInterface(_restriction).viewPermissions(_candidate) & _mask == _mask;  // Permission group
	}

	/***************************************************************************
	 *                       Hashing and signature tools                       *
	 ***************************************************************************/
	function isValidSignature(
		address                     _signer,
		bytes32                     _hash,
		IexecODBLibOrders.signature _signature)
	public view returns (bool)
	{
		return _signer == ecrecover(
			keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash)),
			_signature.v,
			_signature.r,
			_signature.s
		) || m_presigned[_hash];
	}

	function getDappOrderHash(IexecODBLibOrders.DappOrder _dapporder)
	public view returns (bytes32)
	{
		return keccak256(abi.encodePacked(
			address(this),
			keccak256(abi.encodePacked(
				// market
				_dapporder.dapp,
				_dapporder.dappprice,
				_dapporder.volume,
				// restrict
				_dapporder.datarestrict,
				_dapporder.poolrestrict,
				_dapporder.userrestrict
			)),
			// extra
			_dapporder.salt
		));
	}

	function getDataOrderHash(IexecODBLibOrders.DataOrder _dataorder)
	public view returns (bytes32)
	{
		return keccak256(abi.encodePacked(
			address(this),
			keccak256(abi.encodePacked(
				// market
				_dataorder.data,
				_dataorder.dataprice,
				_dataorder.volume,
				// restrict
				_dataorder.dapprestrict,
				_dataorder.poolrestrict,
				_dataorder.userrestrict
			)),
			// extra
			_dataorder.salt
		));
	}

	function getPoolOrderHash(IexecODBLibOrders.PoolOrder _poolorder)
	public view returns (bytes32)
	{
		return keccak256(abi.encodePacked(
			address(this),
			keccak256(abi.encodePacked(
				// market
				_poolorder.pool,
				_poolorder.poolprice,
				_poolorder.volume,
				//settings
				_poolorder.category,
				_poolorder.trust,
				_poolorder.tag,
				// restrict
				_poolorder.dapprestrict,
				_poolorder.datarestrict,
				_poolorder.userrestrict
			)),
			// extra
			_poolorder.salt
		));
	}

	function getUserOrderHash(IexecODBLibOrders.UserOrder _userorder)
	public view returns (bytes32)
	{
		return keccak256(abi.encodePacked(
			address(this),
			keccak256(abi.encodePacked(
				// market
				_userorder.dapp,
				_userorder.dappmaxprice,
				_userorder.data,
				_userorder.datamaxprice,
				_userorder.pool,
				_userorder.poolmaxprice,
				_userorder.volume,
				// settings
				_userorder.category,
				_userorder.trust,
				_userorder.tag,
				_userorder.requester,
				_userorder.beneficiary,
				_userorder.callback,
				_userorder.params
			)),
			// extra
			_userorder.salt
		));
	}

	/***************************************************************************
	 *                            pre-signing tools                            *
	 ***************************************************************************/
	function signDappOrder(IexecODBLibOrders.DappOrder _dapporder)
	public returns (bool)
	{
		require(msg.sender == Dapp(_dapporder.dapp).m_owner());
		m_presigned[getDappOrderHash(_dapporder)] = true;
		return true;
	}

	function signDataOrder(IexecODBLibOrders.DataOrder _dataorder)
	public returns (bool)
	{
		require(msg.sender == Data(_dataorder.data).m_owner());
		m_presigned[getDataOrderHash(_dataorder)] = true;
		return true;
	}

	function signPoolOrder(IexecODBLibOrders.PoolOrder _poolorder)
	public returns (bool)
	{
		require(msg.sender == Pool(_poolorder.pool).m_owner());
		m_presigned[getPoolOrderHash(_poolorder)] = true;
		return true;
	}

	function signUserOrder(IexecODBLibOrders.UserOrder _userorder)
	public returns (bool)
	{
		require(msg.sender == _userorder.requester);
		m_presigned[getUserOrderHash(_userorder)] = true;
		return true;
	}

	/***************************************************************************
	 *                              Clerk methods                              *
	 ***************************************************************************/
	struct Identities
	{
		bytes32 dappHash;
		bytes32 dataHash;
		bytes32 poolHash;
		bytes32 userHash;
		address dappOwner;
		address dataOwner;
		address poolOwner;
		bool    hasData;
	}

	function matchOrders(
		IexecODBLibOrders.DappOrder _dapporder,
		IexecODBLibOrders.DataOrder _dataorder,
		IexecODBLibOrders.PoolOrder _poolorder,
		IexecODBLibOrders.UserOrder _userorder)
	public returns (bytes32)
	{
		/**
		 * Check orders compatibility
		 */

		// computation environment & allowed enough funds
		require(_userorder.category     == _poolorder.category );
		require(_userorder.trust        <= _poolorder.trust    );
		require(_userorder.tag          == _poolorder.tag      );
		require(_userorder.dappmaxprice >= _dapporder.dappprice);
		require(_userorder.datamaxprice >= _dataorder.dataprice);
		require(_userorder.poolmaxprice >= _poolorder.poolprice);

		// Check matching and restrictions
		require(_userorder.dapp == _dapporder.dapp);
		require(_userorder.data == _dataorder.data);
		require(checkRestriction(_userorder.pool,         _poolorder.pool,      0x01 /*IexecPermission.SUBMIT*/ )); // userorder.pool is a restriction
		require(checkRestriction(_dapporder.datarestrict, _dataorder.data,      0x01 /*IexecPermission.SUBMIT*/ ));
		require(checkRestriction(_dapporder.poolrestrict, _poolorder.pool,      0x01 /*IexecPermission.SUBMIT*/ ));
		require(checkRestriction(_dapporder.userrestrict, _userorder.requester, 0x01 /*IexecPermission.SUBMIT*/ ));
		require(checkRestriction(_dataorder.dapprestrict, _dapporder.dapp,      0x01 /*IexecPermission.SUBMIT*/ ));
		require(checkRestriction(_dataorder.poolrestrict, _poolorder.pool,      0x01 /*IexecPermission.SUBMIT*/ ));
		require(checkRestriction(_dataorder.userrestrict, _userorder.requester, 0x01 /*IexecPermission.SUBMIT*/ ));
		require(checkRestriction(_poolorder.dapprestrict, _dapporder.dapp,      0x01 /*IexecPermission.SUBMIT*/ ));
		require(checkRestriction(_poolorder.datarestrict, _dataorder.data,      0x01 /*IexecPermission.SUBMIT*/ ));
		require(checkRestriction(_poolorder.userrestrict, _userorder.requester, 0x01 /*IexecPermission.SUBMIT*/ ));

		require(iexechub.checkResources(_dapporder.dapp, _dataorder.data, _poolorder.pool));

		/**
		 * Check orders authenticity
		 */
		Identities memory ids;
		ids.hasData = _dataorder.data != address(0);

		// dapp
		ids.dappHash  = getDappOrderHash(_dapporder);
		ids.dappOwner = Dapp(_dapporder.dapp).m_owner();
		require(isValidSignature(ids.dappOwner, ids.dappHash, _dapporder.sign));

		// data
		if (ids.hasData) // only check if dataset is enabled
		{
			ids.dataHash  = getDataOrderHash(_dataorder);
			ids.dataOwner = Data(_dataorder.data).m_owner();
			require(isValidSignature(ids.dataOwner, ids.dataHash, _dataorder.sign));
		}

		// pool
		ids.poolHash  = getPoolOrderHash(_poolorder);
		ids.poolOwner = Pool(_poolorder.pool).m_owner();
		require(isValidSignature(ids.poolOwner, ids.poolHash, _poolorder.sign));

		// user
		ids.userHash = getUserOrderHash(_userorder);
		require(isValidSignature(_userorder.requester, ids.userHash, _userorder.sign));

		/**
		 * Check availability
		 */
		// require(m_consumed[hashes[0]] < _dapporder.volume); // checked by volume
		// require(m_consumed[hashes[1]] < _dataorder.volume); // checked by volume
		// require(m_consumed[hashes[2]] < _poolorder.volume); // checked by volume
		// require(m_consumed[hashes[3]] < _userorder.volume); // checked by volume
		uint256 volume;
		volume =                          _dapporder.volume.sub(m_consumed[ids.dappHash]);
		volume = ids.hasData ? volume.min(_dataorder.volume.sub(m_consumed[ids.dataHash])) : volume;
		volume =               volume.min(_poolorder.volume.sub(m_consumed[ids.poolHash]));
		volume =               volume.min(_userorder.volume.sub(m_consumed[ids.userHash]));
		require(volume > 0);

		/**
		 * Record
		 */
		bytes32 dealid = keccak256(abi.encodePacked(
			ids.userHash,            // userHash
			m_consumed[ids.userHash] // idx of first subtask
		));

		IexecODBLibCore.Deal storage deal = m_deals[dealid];
		deal.dapp.pointer = _dapporder.dapp;
		deal.dapp.owner   = ids.dappOwner;
		deal.dapp.price   = _dapporder.dappprice;
		deal.data.owner   = ids.dataOwner;
		deal.data.pointer = _dataorder.data;
		deal.data.price   = ids.hasData ? _dataorder.dataprice : 0;
		deal.pool.pointer = _poolorder.pool;
		deal.pool.owner   = ids.poolOwner;
		deal.pool.price   = _poolorder.poolprice;
		deal.trust        = _poolorder.trust;
		deal.tag          = _poolorder.tag;
		deal.requester    = _userorder.requester;
		deal.beneficiary  = _userorder.beneficiary;
		deal.callback     = _userorder.callback;
		deal.params       = _userorder.params;

		IexecODBLibCore.Config storage config = m_configs[dealid];
		config.category             = _poolorder.category;
		config.startTime            = now;
		config.botFirst             = m_consumed[ids.userHash];
		config.botSize              = volume;
		config.workerStake          = _poolorder.poolprice.percentage(Pool(_poolorder.pool).m_workerStakeRatioPolicy());
		config.schedulerRewardRatio = Pool(_poolorder.pool).m_schedulerRewardRatioPolicy();

		m_userdeals[ids.userHash].push(dealid);

		/**
		 * Update consumed
		 */
		m_consumed[ids.dappHash] = m_consumed[ids.dappHash].add(              volume    );
		m_consumed[ids.dataHash] = m_consumed[ids.dataHash].add(ids.hasData ? volume : 0);
		m_consumed[ids.poolHash] = m_consumed[ids.poolHash].add(              volume    );
		m_consumed[ids.userHash] = m_consumed[ids.userHash].add(              volume    );

		/**
		 * Lock
		 */
		require(lock(
			deal.requester,
			deal.dapp.price
			.add(deal.data.price)
			.add(deal.pool.price)
			.mul(volume)
		));
		require(lock(
			deal.pool.owner,
			deal.pool.price
			.percentage(POOL_STAKE_RATIO)
			.mul(volume)
		));

		/**
		 * Advertize deal
		 */
		emit SchedulerNotice(deal.pool.pointer, dealid);

		/**
		 * Advertize consumption
		 */
		emit OrdersMatched(
			dealid,
			ids.dappHash,
			ids.dataHash,
			ids.poolHash,
			ids.userHash,
			volume
		);

		return dealid;
	}

	function cancelDappOrder(IexecODBLibOrders.DappOrder _dapporder)
	public returns (bool)
	{
		/**
		 * Only Dapp owner can cancel
		 */
		require(msg.sender == Dapp(_dapporder.dapp).m_owner());

		/**
		 * Check authenticity
		 */
		bytes32 dapporderHash = getDappOrderHash(_dapporder);
		require(isValidSignature(
			msg.sender, // dapp owner
			dapporderHash,
			_dapporder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[dapporderHash] = _dapporder.volume;

		emit ClosedDappOrder(dapporderHash);
		return true;
	}

	function cancelDataOrder(IexecODBLibOrders.DataOrder _dataorder)
	public returns (bool)
	{
		/**
		 * Only dataset owner can cancel
		 */
		require(msg.sender == Data(_dataorder.data).m_owner());

		/**
		 * Check authenticity
		 */
		bytes32 dataorderHash = getDataOrderHash(_dataorder);
		require(isValidSignature(
			msg.sender, // dataset owner
			dataorderHash,
			_dataorder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[dataorderHash] = _dataorder.volume;

		emit ClosedDataOrder(dataorderHash);
		return true;
	}

	function cancelPoolOrder(IexecODBLibOrders.PoolOrder _poolorder)
	public returns (bool)
	{
		/**
		 * Only workerpool owner can cancel
		 */
		require(msg.sender == Pool(_poolorder.pool).m_owner());

		/**
		 * Check authenticity
		 */
		bytes32 poolorderHash = getPoolOrderHash(_poolorder);
		require(isValidSignature(
			msg.sender, // workerpool owner
			poolorderHash,
			_poolorder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[poolorderHash] = _poolorder.volume;

		emit ClosedPoolOrder(poolorderHash);
		return true;
	}

	function cancelUserOrder(IexecODBLibOrders.UserOrder _userorder)
	public returns (bool)
	{
		/**
		 * Only requester can cancel
		 */
		require(msg.sender == _userorder.requester);

		/**
		 * Check authenticity
		 */
		bytes32 userorderHash = getUserOrderHash(_userorder);
		require(isValidSignature(
			msg.sender, // requester
			userorderHash,
			_userorder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[userorderHash] = _userorder.volume;

		emit ClosedUserOrder(userorderHash);
		return true;
	}

	/***************************************************************************
	 *                     Escrow overhead for affectation                     *
	 ***************************************************************************/
	function lockSubscription(address _worker, uint256 _amount)
	public onlyIexecHub returns (bool)
	{
		return lock(_worker, _amount);
	}

	function unlockSubscription(address _worker, uint256 _amount)
	public onlyIexecHub returns (bool)
	{
		return unlock(_worker, _amount);
	}

	/***************************************************************************
	 *                    Escrow overhead for contribution                     *
	 ***************************************************************************/
	function lockContribution(bytes32 _dealid, address _worker)
	public onlyIexecHub returns (bool)
	{
		return lock(_worker, m_configs[_dealid].workerStake);
	}

	function unlockContribution(bytes32 _dealid, address _worker)
	public onlyIexecHub returns (bool)
	{
		return unlock(_worker, m_configs[_dealid].workerStake);
	}

	function unlockAndRewardForContribution(bytes32 _dealid, address _worker, uint256 _amount)
	public onlyIexecHub returns (bool)
	{
		return unlock(_worker, m_configs[_dealid].workerStake) && reward(_worker, _amount);
	}

	function seizeContribution(bytes32 _dealid, address _worker)
	public onlyIexecHub returns (bool)
	{
		return seize(_worker, m_configs[_dealid].workerStake);
	}

	function rewardForScheduling(bytes32 _dealid, uint256 _amount)
	public onlyIexecHub returns (bool)
	{
		return reward(m_deals[_dealid].pool.owner, _amount);
	}

	function successWork(bytes32 _dealid)
	public onlyIexecHub returns (bool)
	{
		IexecODBLibCore.Deal memory deal = m_deals[_dealid];

		uint256 userstake = deal.dapp.price
		                    .add(deal.data.price)
		                    .add(deal.pool.price);
		uint256 poolstake = deal.pool.price
		                    .percentage(POOL_STAKE_RATIO);

		require(seize (deal.requester,  userstake));
		require(unlock(deal.pool.owner, poolstake));
		require(reward(deal.dapp.owner, deal.dapp.price));
		require(reward(deal.data.owner, deal.data.price));
		// pool reward performed by consensus manager

		uint256 kitty = viewAccount(this).locked;
		if (kitty > 0)
		{
			kitty = kitty
			        .percentage(KITTY_RATIO) // fraction
			        .max(KITTY_MIN)          // at least this
			        .min(kitty);             // but not more than available
			require(seize (this,            kitty));
			require(reward(deal.pool.owner, kitty));
		}
		return true;
	}

	function failedWork(bytes32 _dealid)
	public onlyIexecHub returns (bool)
	{
		IexecODBLibCore.Deal memory deal = m_deals[_dealid];

		uint256 userstake = deal.dapp.price
		                    .add(deal.data.price)
		                    .add(deal.pool.price);
		uint256 poolstake = deal.pool.price
		                    .percentage(POOL_STAKE_RATIO);

		require(unlock(deal.requester,  userstake));
		require(seize (deal.pool.owner, poolstake));
		require(reward(this,            poolstake)); // → Kitty
		require(lock  (this,            poolstake)); // → Kitty

		return true;
	}

}
