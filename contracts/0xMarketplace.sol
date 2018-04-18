pragma solidity ^0.4.18;
/* import './IexecLib.sol'; */
import './IexecHubAccessor.sol';
import './WorkerPool.sol';
import "./SafeMathOZ.sol";

contract OxMarketplace is IexecHubAccessor
{
	using SafeMathOZ for uint256;

	/**
	 * Marketplace
	 */
	mapping(bytes32 => uint256) public m_consumed;

	/**
	 * Events
	 */
	/* event MarketOrderCancel(bytes32 hash, ); */
	/* event MarketOrderDeal  (bytes32 hash, ); */






	struct Matching
	{
		/********** Order settings **********/
		uint256 common_category;
		uint256 common_trust;
		uint256 common_value;
		/********** Pool settings **********/
		uint256 pool_volume;
		address pool_workerpool;
		address pool_workerpoolOwner;
		uint256 pool_salt;
		bytes32 pool_hash;
		/********** User settings **********/
		address user_app;
		address user_dataset;
		address user_callback;
		address user_beneficiary;
		string  user_params;
		address user_requester;
		uint256 user_salt;
		bytes32 user_hash;
	}




	/**
	 * Constructor
	 */
	function OxMarketplace(address _iexecHubAddress)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
	}









	function isValidSignature(
		address signer,
		bytes32 hash,
		uint8   v,
		bytes32 r,
		bytes32 s)
	public pure returns (bool)
	{
		return signer == ecrecover(keccak256("\x19Ethereum Signed Message:\n32", hash), v, r, s);
	}

	function getPoolOrderHash(
		/********** Order settings **********/
		uint256[3] _commonOrder,
		/* uint256 _commonOrder_category, */
		/* uint256 _commonOrder_trust, */
		/* uint256 _commonOrder_value, */
		/********** Pool settings **********/
		uint256 _poolOrder_volume,
		address _poolOrder_workerpool,
		uint256 _poolOrder_salt)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			_commonOrder[0],
			_commonOrder[1],
			_commonOrder[2],
			_poolOrder_volume,
			_poolOrder_workerpool,
			_poolOrder_salt);
	}

	function getUserOrderHash(
		/********** Order settings **********/
		uint256[3] _commonOrder,
		/* uint256 _commonOrder_category, */
		/* uint256 _commonOrder_trust, */
		/* uint256 _commonOrder_value, */
		/********** User settings **********/
		address[4] _userOrder,
		/* address _userOrder_app, */
		/* address _userOrder_dataset, */
		/* address _userOrder_callback, */
		/* address _userOrder_beneficiary, */
		string  _userOrder_params,
		address _userOrder_requester,
		uint256 _userOrder_salt)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			_commonOrder[0],      // category
			_commonOrder[1],      // trust
			_commonOrder[2],      // value
			_userOrder[0],        // app
			_userOrder[1],        // dataset
			_userOrder[2],        // callback
			_userOrder[3],        // beneficiary
			_userOrder_params,    // params
			_userOrder_requester, // requester
			_userOrder_salt       // salt
		);
	}

	/**
	 * Deal on Market
	 */
	function matchOrders(
		/********** Order settings **********/
		uint256[3] _commonOrder,
		/* uint256 _commonOrder_category, */
		/* uint256 _commonOrder_trust, */
		/* uint256 _commonOrder_value, */
		/********** Pool settings **********/
		uint256 _poolOrder_volume,
		address _poolOrder_workerpool,
		/********** User settings **********/
		address[4] _userOrder,
		/* address _userOrder_app, */
		/* address _userOrder_dataset, */
		/* address _userOrder_callback, */
		/* address _userOrder_beneficiary, */
		string  _userOrder_params,
		address _userOrder_requester,
		/********** Signatures **********/
		uint256[2] _salt,
		uint8[2]   _v,
		bytes32[2] _r,
		bytes32[2] _s)
	public returns(bool)
	{
		Matching memory matching = Matching({
			common_category:      _commonOrder[0],
			common_trust:         _commonOrder[1],
			common_value:         _commonOrder[2],
			pool_volume:          _poolOrder_volume,
			pool_workerpool:      _poolOrder_workerpool,
			pool_workerpoolOwner: WorkerPool(_poolOrder_workerpool).m_owner(),
			pool_salt:            _salt[0],
			pool_hash:            getPoolOrderHash(_commonOrder, _poolOrder_volume, _poolOrder_workerpool, _salt[0]),
			user_app:             _userOrder[0],
			user_dataset:         _userOrder[1],
			user_callback:        _userOrder[2],
			user_beneficiary:     _userOrder[3],
			user_params:          _userOrder_params,
			user_requester:       _userOrder_requester,
			user_salt:            _salt[1],
			user_hash:            getUserOrderHash(_commonOrder, _userOrder, _userOrder_params, _userOrder_requester, _salt[1])
		});

		// Check signatures
		require(isValidSignature(matching.pool_workerpoolOwner, matching.pool_hash, _v[0], _r[0], _s[0]));
		require(isValidSignature(matching.user_requester,       matching.user_hash, _v[1], _r[1], _s[1]));

		require(iexecHubInterface.existingCategory(matching.common_category));

		// check consumption
		require(m_consumed[matching.pool_hash] <  matching.pool_volume);
		require(m_consumed[matching.user_hash] == 0);
		m_consumed[matching.pool_hash] = m_consumed[matching.pool_hash].add(1);
		m_consumed[matching.user_hash] = 1;

		// lock all stake
		/* require(iexecHubInterface.lockForOrder(matching.pool_workerpoolOwner, matching.common_value)); */
		/* require(iexecHubInterface.lockForOrder(matching.user_requester,       matching.common_value)); */

		// TODO: Event
		return true;
	}







	function cancelPoolMarket(
		/********** Order settings **********/
		uint256[3] _commonOrder,
		/* uint256 _commonOrder_category, */
		/* uint256 _commonOrder_trust, */
		/* uint256 _commonOrder_value, */
		/********** Pool settings **********/
		uint256 _poolOrder_volume,
		address _poolOrder_workerpool,
		/********** Signature **********/
		uint256 _salt,
		uint8   _v,
		bytes32 _r,
		bytes32 _s)
	public returns (bool)
	{
		// msg.sender = workerpoolOwner
		require(msg.sender == WorkerPool(_poolOrder_workerpool).m_owner());

		// compute hashs & check signatures
		bytes32 poolHash = getPoolOrderHash(_commonOrder, _poolOrder_volume, _poolOrder_workerpool, _salt);
		require(isValidSignature(msg.sender, poolHash, _v, _r, _s));

		m_consumed[poolHash] = _poolOrder_volume;

		return true;
	}

	function cancelUserMarket(
		/********** Order settings **********/
		uint256[3] _commonOrder,
		/* uint256 _commonOrder_category, */
		/* uint256 _commonOrder_trust, */
		/* uint256 _commonOrder_value, */
		/********** User settings **********/
		address[4] _userOrder,
		/* address _userOrder_app, */
		/* address _userOrder_dataset, */
		/* address _userOrder_callback, */
		/* address _userOrder_beneficiary, */
		string  _userOrder_params,
		address _userOrder_requester,
		/********** Signature **********/
		uint256 _salt,
		uint8   _v,
		bytes32 _r,
		bytes32 _s)
	public returns (bool)
	{
		// msg.sender = requester
		require(msg.sender == _requester);

		// compute hashs & check signatures
		bytes32 userHash = getUserOrderHash(_commonOrder, _userOrder, _userOrder_params, _userOrder_requester, _salt);
		require(isValidSignature(msg.sender, userHash, _v, _r, _s));

		m_consumed[userHash] = 1;

		return true;
	}

}
