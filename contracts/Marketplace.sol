pragma solidity ^0.4.18;
/* import './IexecLib.sol'; */
import './IexecHubAccessor.sol';
import './WorkerPool.sol';
import "./SafeMathOZ.sol";

contract Marketplace is IexecHubAccessor
{
	using SafeMathOZ for uint256;

	/**
	 * Marketplace
	 */
	// IexecLib.MarketMatching[]   public m_matchings;
	mapping(bytes32 => uint256) public m_consumed;

	uint256 public constant ASK_STAKE_RATIO = 30;

	/**
	 * Events
	 */
	/* event MarketOrderCancel(bytes32 hash, ); */
	/* event MarketOrderDeal  (bytes32 hash, ); */

	/**
	 * Constructor
	 */
	function Marketplace(address _iexecHubAddress)
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
		address[5] _userOrder,
		/* address _userOrder_app, */
		/* address _userOrder_dataset, */
		/* address _userOrder_callback, */
		/* address _userOrder_beneficiary, */
		/* address _userOrder_requester, */
		string  _userOrder_params,
		uint256 _userOrder_salt)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			_commonOrder[0],   // category
			_commonOrder[1],   // trust
			_commonOrder[2],   // value
			_userOrder[0],     // app
			_userOrder[1],     // dataset
			_userOrder[2],     // callback
			_userOrder[3],     // beneficiary
			_userOrder[4],     // requester
			_userOrder_params, // params
			_userOrder_salt    // salt
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
		address[5] _userOrder,
		/* address _userOrder_app, */
		/* address _userOrder_dataset, */
		/* address _userOrder_callback, */
		/* address _userOrder_beneficiary, */
		/* address _userOrder_requester, */
		string  _userOrder_params,
		/********** Signatures **********/
		uint256[2] _salt,
		uint8[2]   _v,
		bytes32[2] _r,
		bytes32[2] _s)
	public returns(bool)
	{
		IexecLib.MarketMatching memory matching = IexecLib.MarketMatching({
			common_category:      _commonOrder[0],
			common_trust:         _commonOrder[1],
			common_value:         _commonOrder[2],
			pool_volume:          _poolOrder_volume,
			pool_workerpool:      _poolOrder_workerpool,
			pool_workerpoolOwner: WorkerPool(_poolOrder_workerpool).m_owner(),
			pool_salt:            _salt[0],
			user_app:             _userOrder[0],
			user_dataset:         _userOrder[1],
			user_callback:        _userOrder[2],
			user_beneficiary:     _userOrder[3],
			user_requester:       _userOrder[4],
			user_params:          _userOrder_params,
			user_salt:            _salt[1]
		});

		bytes32 poolHash = getPoolOrderHash(_commonOrder, _poolOrder_volume, _poolOrder_workerpool, _salt[0]);
		bytes32 userHash = getUserOrderHash(_commonOrder, _userOrder, _userOrder_params, _salt[1]);

		// Check signatures
		require(isValidSignature(matching.pool_workerpoolOwner, poolHash, _v[0], _r[0], _s[0]));
		require(isValidSignature(matching.user_requester,       userHash, _v[1], _r[1], _s[1]));

		require(iexecHubInterface.existingCategory(matching.common_category));

		// check consumption
		require(m_consumed[poolHash] <  matching.pool_volume);
		require(m_consumed[userHash] == 0);
		m_consumed[poolHash] = m_consumed[poolHash].add(1);
		m_consumed[userHash] = 1;

		// Lock
		require(iexecHubInterface.lockForOrder(matching.pool_workerpoolOwner, matching.common_value.percentage(ASK_STAKE_RATIO).mul(matching.pool_volume))); // mul must be done after percentage to avoid rounding errors
		require(iexecHubInterface.lockForOrder(matching.user_requester,       matching.common_value)); // Lock funds for app + dataset payment

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
		address[5] _userOrder,
		/* address _userOrder_app, */
		/* address _userOrder_dataset, */
		/* address _userOrder_callback, */
		/* address _userOrder_beneficiary, */
		/* address _userOrder_requester, */
		string  _userOrder_params,
		/********** Signature **********/
		uint256 _salt,
		uint8   _v,
		bytes32 _r,
		bytes32 _s)
	public returns (bool)
	{
		// msg.sender = requester
		require(msg.sender == _userOrder[4]);

		// compute hashs & check signatures
		bytes32 userHash = getUserOrderHash(_commonOrder, _userOrder, _userOrder_params, _salt);
		require(isValidSignature(msg.sender, userHash, _v, _r, _s));

		m_consumed[userHash] = 1;

		return true;
	}

}
