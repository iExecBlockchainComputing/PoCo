pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./Iexec0xLib.sol";
import "./tools/SafeMathOZ.sol";

import "./Escrow.sol";
import "./IexecHubAccessor.sol";

import "./resources_contract/DappHub.sol";
import "./resources_contract/DataHub.sol";
import "./resources_contract/PoolHub.sol";

contract Marketplace is Escrow, IexecHubAccessor
{
	using SafeMathOZ for uint256;

	/***************************************************************************
	 *                                Constants                                *
	 ***************************************************************************/
	uint256 public constant POOL_STAKE_RATIO    = 30;
	uint256 public constant KITTY_RATIO         = 10;
	uint256 public constant KITTY_MIN           = 1000;

	/***************************************************************************
	 *                            Marketplace data                             *
	 ***************************************************************************/
	mapping(bytes32 => Iexec0xLib.Deal) public m_deals;
	mapping(bytes32 => uint256        ) public m_consumed;

	/***************************************************************************
	 *                                 Events                                  *
	 ***************************************************************************/
	event OrdersMatched  (bytes32 dappHash,
	                      bytes32 dataHash,
	                      bytes32 poolHash,
	                      bytes32 userHash);
	event ClosedDappOrder(bytes32 dappHash);
	event ClosedDataOrder(bytes32 dataHash);
	event ClosedPoolOrder(bytes32 poolHash);
	event ClosedUserOrder(bytes32 userHash);

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
	function viewDeal(bytes32 _id)
	public view returns (Iexec0xLib.Deal)
	{
		return m_deals[_id];
	}

	function viewConsumed(bytes32 _id)
	public view returns (uint256)
	{
		return m_consumed[_id];
	}

	/***************************************************************************
	 *                       Hashing and signature tools                       *
	 ***************************************************************************/
	function isValidSignature(
		address              _signer,
		bytes32              _hash,
		Iexec0xLib.signature _signature)
	public pure returns (bool)
	{
		return _signer == ecrecover(keccak256("\x19Ethereum Signed Message:\n32", _hash), _signature.v, _signature.r, _signature.s);
	}

	function getDappOrderHash(Iexec0xLib.DappOrder _dapporder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			_dapporder.dapp,
			_dapporder.dappprice,
			_dapporder.volume,
			// extra
			_dapporder.salt
		);
	}

	function getDataOrderHash(Iexec0xLib.DataOrder _dataorder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			_dataorder.data,
			_dataorder.dataprice,
			_dataorder.volume,
			// extra
			_dataorder.salt
		);
	}

	function getPoolOrderHash(Iexec0xLib.PoolOrder _poolorder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			_poolorder.pool,
			_poolorder.poolprice,
			_poolorder.volume,
			// settings
			_poolorder.category,
			_poolorder.trust,
			// extra
			_poolorder.salt
		);
	}

	function getUserOrderHash(Iexec0xLib.UserOrder _userorder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			_userorder.dapp,
			_userorder.dapppricemax,
			_userorder.data,
			_userorder.datapricemax,
			_userorder.pool,
			_userorder.poolpricemax,
			// settings
			_userorder.category,
			_userorder.trust,
			_userorder.requester,
			_userorder.beneficiary,
			_userorder.callback,
			_userorder.params,
			// extra
			_userorder.salt
		);
	}

	/***************************************************************************
	 *                           Marketplace methods                           *
	 ***************************************************************************/
	function matchOrders(
		Iexec0xLib.DappOrder _dapporder,
		Iexec0xLib.DataOrder _dataorder,
		Iexec0xLib.PoolOrder _poolorder,
		Iexec0xLib.UserOrder _userorder)
	public returns (bytes32)
	{
		/**
		 * Check orders compatibility
		 */
		// computation environment
		require(_userorder.category == _poolorder.category );
		require(_userorder.trust    == _poolorder.trust    );

		// user allowed enugh ressources.
		require(_userorder.dapppricemax >= _dapporder.dappprice);
		require(_userorder.datapricemax >= _dataorder.dataprice);
		require(_userorder.poolpricemax >= _poolorder.poolprice);

		// pairing is valid
		require(_userorder.dapp == _dapporder.dapp);
		require(_userorder.data == _dataorder.data);
		require(_userorder.pool == address(0)
		     || _userorder.pool == _poolorder.pool);

		require(iexechub.checkResources(_dapporder.dapp, _dataorder.data, _poolorder.pool));

		/**
		 * Check orders authenticity
		 */
		// dapp
		bytes32 dapporderHash = getDappOrderHash(_dapporder);
		address dappowner     = Dapp(_dapporder.dapp).m_owner();
		require(isValidSignature(dappowner, dapporderHash, _dapporder.sign));

		// data
		bytes32 dataorderHash = getDataOrderHash(_dataorder);
		address dataowner     = 0;
		if (_dataorder.data != address(0)) // only check if dataset is enabled
		{
			dataowner = Data(_dataorder.data).m_owner();
			require(isValidSignature(dataowner, dataorderHash, _dataorder.sign));
		}

		// pool
		bytes32 poolorderHash = getPoolOrderHash(_poolorder);
		address poolowner     = Pool(_poolorder.pool).m_owner();
		require(isValidSignature(poolowner, poolorderHash, _poolorder.sign));

		// user
		bytes32 userorderHash = getUserOrderHash(_userorder);
		require(isValidSignature(_userorder.requester, userorderHash, _userorder.sign));

		/**
		 * Check and update availability
		 */
		require(m_consumed[dapporderHash] <  _dapporder.volume);
		require(m_consumed[dataorderHash] <  _dataorder.volume);
		require(m_consumed[poolorderHash] <  _poolorder.volume);
		require(m_consumed[userorderHash] == 0);
		m_consumed[dapporderHash] = m_consumed[dapporderHash].add(1);
		m_consumed[dataorderHash] = m_consumed[dataorderHash].add(1);
		m_consumed[poolorderHash] = m_consumed[poolorderHash].add(1);
		m_consumed[userorderHash] = 1;

		/**
		 * Record
		 */
		Iexec0xLib.Deal storage deal = m_deals[userorderHash];
		deal.dapp.pointer         = _dapporder.dapp;
		deal.dapp.owner           = dappowner;
		deal.dapp.price           = _dapporder.dappprice;
		deal.data.owner           = dataowner;
		deal.data.pointer         = _dataorder.data;
		deal.data.price           = _dataorder.dataprice;
		deal.pool.pointer         = _poolorder.pool;
		deal.pool.owner           = poolowner;
		deal.pool.price           = _poolorder.poolprice;
		deal.category             = _userorder.category;
		deal.trust                = _userorder.trust;
		deal.requester            = _userorder.requester;
		deal.beneficiary          = _userorder.beneficiary;
		deal.callback             = _userorder.callback;
		deal.params               = _userorder.params;
		deal.workerStake          = _poolorder.poolprice.percentage(Pool(_poolorder.pool).m_workerStakeRatioPolicy());
		deal.schedulerRewardRatio = Pool(_poolorder.pool).m_schedulerRewardRatioPolicy();

		/**
		 * Lock
		 */
		require(lock(
			deal.requester,
			deal.dapp.price
			.add(deal.data.price)
			.add(deal.pool.price)
		));
		require(lock(
			deal.pool.owner,
			deal.pool.price
			.percentage(POOL_STAKE_RATIO)
		));

		/**
		 * Initiate workorder & consensus
		 */
		iexechub.initialize(userorderHash);

		/**
		 * Advertize
		 */
		emit OrdersMatched(
			dapporderHash,
			dataorderHash,
			poolorderHash,
			userorderHash
		);
		return userorderHash;
	}

	function cancelDappOrder(Iexec0xLib.DappOrder _dapporder)
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

	function cancelDataOrder(Iexec0xLib.DataOrder _dataorder)
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

	function cancelPoolOrder(Iexec0xLib.PoolOrder _poolorder)
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

	function cancelUserOrder(Iexec0xLib.UserOrder _userorder)
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
		m_consumed[userorderHash] = 1;

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
	function lockContribution(bytes32 _woid, address _worker)
	public onlyIexecHub returns (bool)
	{
		return lock(_worker, m_deals[_woid].workerStake);
	}

	function unlockContribution(bytes32 _woid, address _worker)
	public onlyIexecHub returns (bool)
	{
		return unlock(_worker, m_deals[_woid].workerStake);
	}

	function seizeContribution(bytes32 _woid, address _worker)
	public onlyIexecHub returns (bool)
	{
		return seize(_worker, m_deals[_woid].workerStake);
	}

	function rewardForContribution(bytes32 _woid, address _worker, uint256 _amount)
	public onlyIexecHub returns (bool)
	{
		return reward(_worker, _amount);
	}

	function rewardForScheduling(bytes32 _woid, uint256 _amount)
	public onlyIexecHub returns (bool)
	{
		return reward(m_deals[_woid].pool.owner, _amount);
	}

	function successWork(bytes32 _woid)
	public onlyIexecHub returns (bool)
	{
		Iexec0xLib.Deal memory deal = m_deals[_woid];

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

	function failedWork(bytes32 _woid)
	public onlyIexecHub returns (bool)
	{
		Iexec0xLib.Deal memory deal = m_deals[_woid];

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
