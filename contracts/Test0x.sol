pragma solidity ^0.4.18;

contract Test0x
{
	event gotHash(bytes32);


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
		uint256[3] _order,
		/* uint256 _category, */
		/* uint256 _trust, */
		/* uint256 _value, */
		/********** Pool settings **********/
		uint256 _volume,
		address _workerpool,
		uint256 _salt)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			_order[0],
			_order[1],
			_order[2],
			_volume,
			_workerpool,
			_salt);
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
		uint256 _salt)
	public view returns (bytes32)
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
			_params,    // params
			_requester, // requester
			_salt       // salt
		);
	}



}
