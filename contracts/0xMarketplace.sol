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
		uint256 category;
		uint256 trust;
		uint256 value;
		/********** Pool settings **********/
		uint256 volume;
		address workerpool;
		address workerpoolOwner;
		uint256 poolSalt;
		bytes32 poolHash;
		/********** User settings **********/
		address app;
		address dataset;
		address callback;
		address beneficiary;
		string  params;
		address requester;
		uint256 userSalt;
		bytes32 userHash;
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
	public constant returns (bool)
	{
		return signer == ecrecover(hash, v, r, s);
	}

	function getPoolOrderHash(
		/********** Order settings **********/
		uint256[3] _order,
		/* uint256 _category, */
		/* uint256 _trust, */
		/* uint256 _value, */
		/********** Pool settings **********/
		uint256 _volume,
		address _workerpool,
		/********** Signatures **********/
		uint256 _salt)
	public constant returns (bytes32)
	{
		return keccak256(
			address(this),
			_order[0],   // category
			_order[1],   // trust
			_order[2],   // value
			_volume,     // salt
			_workerpool, // salt
			_salt);      // salt
	}

	function getUserOrderHash(
		/********** Order settings **********/
		uint256[3] _order,
		/* uint256 _category, */
		/* uint256 _trust, */
		/* uint256 _value, */
		/********** User settings **********/
		address[4] _work,
		/* address _app, */
		/* address _dataset, */
		/* address _callback, */
		/* address _beneficiary, */
		string  _params,
		address _requester,
		/********** Signatures **********/
		uint256 _salt)
	public constant returns (bytes32)
	{
		return keccak256(
			address(this),
			_order[0],  // category
			_order[1],  // trust
			_order[2],  // value
			_work[0],   // app
			_work[1],   // dataset
			_work[2],   // callback
			_work[3],   // beneficiary
			_params,    // salt
			_requester, // salt
			_salt);     // salt
	}








	/**
	 * Deal on Market
	 */
	function fillOrder(
		/********** Order settings **********/
		uint256[3] _order,
		/* uint256 _category, */
		/* uint256 _trust, */
		/* uint256 _value, */
		/********** Pool settings **********/
		uint256 _volume,
		address _workerpool,
		/********** User settings **********/
		address[4] _work,
		/* address _app, */
		/* address _dataset, */
		/* address _callback, */
		/* address _beneficiary, */
		string  _params,
		address _requester,
		/********** Signatures **********/
		uint256[2] _salt,
		uint8[2]   _v,
		bytes32[2] _r,
		bytes32[2] _s)
	public returns(bool)
	{

		Matching memory matching = Matching({
			category:        _order[0],
			trust:           _order[1],
			value:           _order[2],
			volume:          _volume,
			workerpool:      _workerpool,
			workerpoolOwner: WorkerPool(_workerpool).m_owner(),
			poolSalt:        _salt[0],
			poolHash:        getPoolOrderHash(_order, _volume, _workerpool, _salt[0]),
			app:             _work[0],
			dataset:         _work[1],
			callback:        _work[2],
			beneficiary:     _work[3],
			params:          _params,
			requester:       _requester,
			userSalt:        _salt[1],
			userHash:        getUserOrderHash(_order, _work, _params, _requester, _salt[1])
		});

		require(iexecHubInterface.existingCategory(matching.category));

		// Check signatures
		require(isValidSignature(matching.workerpoolOwner, matching.poolHash, _v[0], _r[0], _s[0]));
		require(isValidSignature(matching.requester,       matching.userHash, _v[1], _r[1], _s[1]));

		// check consumption
		require(m_consumed[matching.poolHash] <  matching.volume);
		require(m_consumed[matching.userHash] == 0);
		m_consumed[matching.poolHash] = m_consumed[matching.poolHash].add(1);
		m_consumed[matching.userHash] = 1;

		// lock all stake
		require(iexecHubInterface.lockForOrder(matching.workerpoolOwner, matching.value));
		require(iexecHubInterface.lockForOrder(matching.requester,       matching.value));

		// TODO: Event
		return true;
	}







	function cancelPoolMarket(
		/********** Order settings **********/
		uint256[3] _order,
		/* uint256 _category, */
		/* uint256 _trust, */
		/* uint256 _value, */
		/********** Pool settings **********/
		uint256 _volume,
		address _workerpool,
		/********** Signature **********/
		uint256 _salt,
		uint8   _v,
		bytes32 _r,
		bytes32 _s)
	public returns (bool)
	{
		// msg.sender = workerpoolOwner
		require(msg.sender == WorkerPool(_workerpool).m_owner());

		// compute hashs & check signatures
		bytes32 poolHash = getPoolOrderHash(_order, _volume, _workerpool, _salt);
		require(isValidSignature(msg.sender, poolHash, _v, _r, _s));

		m_consumed[poolHash] = _volume;

		return true;
	}

	function cancelUserMarket(
		/********** Order settings **********/
		uint256[3] _order,
		/* uint256 _category, */
		/* uint256 _trust, */
		/* uint256 _value, */
		/********** User settings **********/
		address[4] _workdescription,
		/* address _app, */
		/* address _dataset, */
		/* address _callback, */
		/* address _beneficiary, */
		string  _params,
		address _requester,
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
		bytes32 userHash = getUserOrderHash(_order, _workdescription, _params, _requester, _salt);
		require(isValidSignature(msg.sender, userHash, _v, _r, _s));

		m_consumed[userHash] = 1;

		return true;
	}

}
