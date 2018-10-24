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

/**
 * /!\ TEMPORARY LEGACY /!\
 */
import "./IexecClerkABILegacy.sol";

contract IexecClerk is Escrow, IexecHubAccessor, IexecClerkABILegacy
{
	using SafeMathOZ for uint256;
	using IexecODBLibOrders for *;

	/***************************************************************************
	 *                                Constants                                *
	 ***************************************************************************/
	uint256 public constant POOL_STAKE_RATIO = 30;
	uint256 public constant KITTY_RATIO      = 10;
	uint256 public constant KITTY_MIN        = 1000000000; // TODO: 1RLC ?

	/***************************************************************************
	 *                            EIP712 signature                             *
	 ***************************************************************************/
	bytes32 public /* immutable */ EIP712DOMAIN_SEPARATOR;

	/***************************************************************************
	 *                               Clerk data                                *
	 ***************************************************************************/
	mapping(bytes32 => bytes32[]             ) m_userdeals;
	mapping(bytes32 => IexecODBLibCore.Deal  ) m_deals;
	mapping(bytes32 => IexecODBLibCore.Config) m_configs;
	mapping(bytes32 => uint256               ) m_consumed;
	mapping(bytes32 => bool                  ) m_presigned;

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
		EIP712DOMAIN_SEPARATOR = IexecODBLibOrders.EIP712Domain({
			name:              "iExecODB"
		, version:           "3.0-alpha"
		, chainId:           26
		, verifyingContract: this
		}).hash();
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

	function viewPresigned(bytes32 _id)
	public view returns (bool)
	{
		return m_presigned[_id];
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
	function verify(
		address                     _signer,
		bytes32                     _hash,
		IexecODBLibOrders.signature _signature)
	public view returns (bool)
	{
		return _signer == ecrecover(
			keccak256(abi.encodePacked("\x19\x01", EIP712DOMAIN_SEPARATOR, _hash)),
			_signature.v,
			_signature.r,
			_signature.s
		) || m_presigned[_hash];
	}

	/***************************************************************************
	 *                            pre-signing tools                            *
	 ***************************************************************************/
	function signDappOrder(IexecODBLibOrders.DappOrder _dapporder)
	public returns (bool)
	{
		require(msg.sender == Dapp(_dapporder.dapp).m_owner());
		m_presigned[_dapporder.hash()] = true;
		return true;
	}

	function signDataOrder(IexecODBLibOrders.DataOrder _dataorder)
	public returns (bool)
	{
		require(msg.sender == Data(_dataorder.data).m_owner());
		m_presigned[_dataorder.hash()] = true;
		return true;
	}

	function signPoolOrder(IexecODBLibOrders.PoolOrder _poolorder)
	public returns (bool)
	{
		require(msg.sender == Pool(_poolorder.pool).m_owner());
		m_presigned[_poolorder.hash()] = true;
		return true;
	}

	function signUserOrder(IexecODBLibOrders.UserOrder _userorder)
	public returns (bool)
	{
		require(msg.sender == _userorder.requester);
		m_presigned[_userorder.hash()] = true;
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
		ids.dappHash  = _dapporder.hash();
		ids.dappOwner = Dapp(_dapporder.dapp).m_owner();
		require(verify(ids.dappOwner, ids.dappHash, _dapporder.sign));

		// data
		if (ids.hasData) // only check if dataset is enabled
		{
			ids.dataHash  = _dataorder.hash();
			ids.dataOwner = Data(_dataorder.data).m_owner();
			require(verify(ids.dataOwner, ids.dataHash, _dataorder.sign));
		}

		// pool
		ids.poolHash  = _poolorder.hash();
		ids.poolOwner = Pool(_poolorder.pool).m_owner();
		require(verify(ids.poolOwner, ids.poolHash, _poolorder.sign));

		// user
		ids.userHash = _userorder.hash();
		require(verify(_userorder.requester, ids.userHash, _userorder.sign));

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
		lock(
			deal.requester,
			deal.dapp.price
			.add(deal.data.price)
			.add(deal.pool.price)
			.mul(volume)
		);
		lock(
			deal.pool.owner,
			deal.pool.price
			.percentage(POOL_STAKE_RATIO) // ORDER IS IMPORTANT HERE!
			.mul(volume)                  // ORDER IS IMPORTANT HERE!
		);

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
		bytes32 dapporderHash = _dapporder.hash();
		require(msg.sender == Dapp(_dapporder.dapp).m_owner());
		// require(verify(msg.sender, dapporderHash, _dapporder.sign));
		m_consumed[dapporderHash] = _dapporder.volume;
		emit ClosedDappOrder(dapporderHash);
		return true;
	}

	function cancelDataOrder(IexecODBLibOrders.DataOrder _dataorder)
	public returns (bool)
	{
		bytes32 dataorderHash = _dataorder.hash();
		require(msg.sender == Data(_dataorder.data).m_owner());
		// require(verify(msg.sender, dataorderHash, _dataorder.sign));
		m_consumed[dataorderHash] = _dataorder.volume;
		emit ClosedDataOrder(dataorderHash);
		return true;
	}

	function cancelPoolOrder(IexecODBLibOrders.PoolOrder _poolorder)
	public returns (bool)
	{
		bytes32 poolorderHash = _poolorder.hash();
		require(msg.sender == Pool(_poolorder.pool).m_owner());
		// require(verify(msg.sender, poolorderHash, _poolorder.sign));
		m_consumed[poolorderHash] = _poolorder.volume;
		emit ClosedPoolOrder(poolorderHash);
		return true;
	}

	function cancelUserOrder(IexecODBLibOrders.UserOrder _userorder)
	public returns (bool)
	{
		bytes32 userorderHash = _userorder.hash();
		require(msg.sender == _userorder.requester);
		// require(verify(msg.sender, userorderHash, _userorder.sign));
		m_consumed[userorderHash] = _userorder.volume;
		emit ClosedUserOrder(userorderHash);
		return true;
	}

	/***************************************************************************
	 *                     Escrow overhead for affectation                     *
	 ***************************************************************************/
	function lockSubscription  (address _worker, uint256 _amount)
	public onlyIexecHub
	{
		lock(_worker, _amount);
	}

	function unlockSubscription(address _worker, uint256 _amount)
	public onlyIexecHub
	{
		unlock(_worker, _amount);
	}

	/***************************************************************************
	 *                    Escrow overhead for contribution                     *
	 ***************************************************************************/
	function lockContribution(bytes32 _dealid, address _worker)
	public onlyIexecHub
	{
		lock(_worker, m_configs[_dealid].workerStake);
	}

	function unlockContribution(bytes32 _dealid, address _worker)
	public onlyIexecHub
	{
		unlock(_worker, m_configs[_dealid].workerStake);
	}

	function unlockAndRewardForContribution(bytes32 _dealid, address _worker, uint256 _amount)
	public onlyIexecHub
	{
		unlock(_worker, m_configs[_dealid].workerStake);
		reward(_worker, _amount);
	}

	function seizeContribution(bytes32 _dealid, address _worker)
	public onlyIexecHub
	{
		seize(_worker, m_configs[_dealid].workerStake);
	}

	function rewardForScheduling(bytes32 _dealid, uint256 _amount)
	public onlyIexecHub
	{
		reward(m_deals[_dealid].pool.owner, _amount);
	}

	function successWork(bytes32 _dealid)
	public onlyIexecHub
	{
		IexecODBLibCore.Deal memory deal = m_deals[_dealid];

		uint256 userstake = deal.dapp.price
		                    .add(deal.data.price)
		                    .add(deal.pool.price);
		uint256 poolstake = deal.pool.price
		                    .percentage(POOL_STAKE_RATIO);

		// seize requester funds
		seize (deal.requester,  userstake);
		// unlock pool stake
		unlock(deal.pool.owner, poolstake);
		// dapp reward
		reward(deal.dapp.owner, deal.dapp.price);
		// data reward
		if (deal.data.pointer != address(0))
		{
			reward(deal.data.owner, deal.data.price);
		}
		// pool reward performed by consensus manager

		/**
		 * Retrieve part of the kitty
		 * TODO: remove / keep ?
		 */
		uint256 kitty = viewAccount(address(0)).locked;
		if (kitty > 0)
		{
			kitty = kitty
			        .percentage(KITTY_RATIO) // fraction
			        .max(KITTY_MIN)          // at least this
			        .min(kitty);             // but not more than available
			seize (address(0),      kitty);
			reward(deal.pool.owner, kitty);
		}
	}

	function failedWork(bytes32 _dealid)
	public onlyIexecHub
	{
		IexecODBLibCore.Deal memory deal = m_deals[_dealid];

		uint256 userstake = deal.dapp.price
		                    .add(deal.data.price)
		                    .add(deal.pool.price);
		uint256 poolstake = deal.pool.price
		                    .percentage(POOL_STAKE_RATIO);

		unlock(deal.requester,  userstake);
		seize (deal.pool.owner, poolstake);
		reward(address(0),      poolstake); // → Kitty / Burn
		lock  (address(0),      poolstake); // → Kitty / Burn
	}


















	/**
	 * /!\ TEMPORARY LEGACY /!\
	 */

	function viewDealABILegacy_pt1(bytes32 _id)
	public view returns
	( address
	, address
	, uint256
	, address
	, address
	, uint256
	, address
	, address
	, uint256
	)
	{
		IexecODBLibCore.Deal memory deal = viewDeal(_id);
		return (
			deal.dapp.pointer,
			deal.dapp.owner,
			deal.dapp.price,
			deal.data.pointer,
			deal.data.owner,
			deal.data.price,
			deal.pool.pointer,
			deal.pool.owner,
			deal.pool.price
		);
	}

	function viewDealABILegacy_pt2(bytes32 _id)
	public view returns
	( uint256
	, uint256
	, address
	, address
	, address
	, string
	)
	{
		IexecODBLibCore.Deal memory deal = viewDeal(_id);
		return (
			deal.trust,
			deal.tag,
			deal.requester,
			deal.beneficiary,
			deal.callback,
			deal.params
		);
	}

	function viewConfigABILegacy(bytes32 _id)
	public view returns
	( uint256
	, uint256
	, uint256
	, uint256
	, uint256
	, uint256
	)
	{
		IexecODBLibCore.Config memory config = viewConfig(_id);
		return (
			config.category,
			config.startTime,
			config.botFirst,
			config.botSize,
			config.workerStake,
			config.schedulerRewardRatio
		);
	}

	function viewAccountABILegacy(address _user)
	public view returns (uint256, uint256)
	{
		IexecODBLibCore.Account memory account = viewAccount(_user);
		return ( account.stake, account.locked );
	}
}
