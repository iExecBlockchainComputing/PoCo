pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

contract TestABIEncoderV2
{

	struct UserMarket
	{
		uint256 category;
		uint256 trust;
		uint256 value;
		address app;
		address dataset;
		address callback;
		address beneficiary;
		address requester;
		string  params;
		uint256 salt;
		uint8   v;
		bytes32 r;
		bytes32 s;
	}
	struct PoolMarket
	{
		uint256 category;
		uint256 trust;
		uint256 value;
		uint256 volume;
		address workerpool;
		uint256 salt;
		uint8   v;
		bytes32 r;
		bytes32 s;
	}




	function getUserMarketHash(UserMarket usermarket)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			usermarket.category,
			usermarket.trust,
			usermarket.value,
			usermarket.app,
			usermarket.dataset,
			usermarket.callback,
			usermarket.beneficiary,
			usermarket.requester,
			usermarket.params,
			usermarket.salt
		);
	}

	function getPoolMarketHash(PoolMarket poolmarket)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			poolmarket.category,
			poolmarket.trust,
			poolmarket.value,
			poolmarket.volume,
			poolmarket.workerpool,
			poolmarket.salt
		);
	}

	function isValidSignature(
		address signer,
		bytes32 hash,
		uint8   v,
		bytes32 r,
		bytes32 s)
	public pure returns (bool)
	{
		/* return signer == ecrecover(keccak256("\x19Ethereum Signed Message:\n32", hash), v, r, s); */
		return signer == ecrecover(keccak256("\x19Ethereum Signed Message:\n0"), v, r, s);
	}


	function matchOrders(
		UserMarket usermarket,
		PoolMarket poolmarket)
	public view returns (bool)
	{
		require(usermarket.category == poolmarket.category);
		require(usermarket.trust    == poolmarket.trust   );
		require(usermarket.value    == poolmarket.value   );

		bytes32 usermarketHash = getUserMarketHash(usermarket);
		require(isValidSignature(
			usermarket.requester,
			usermarketHash,
			usermarket.v,
			usermarket.r,
			usermarket.s
		));

		bytes32 poolmarketHash = getPoolMarketHash(poolmarket);
		require(isValidSignature(
			poolmarket.workerpool, // TODO: workerpoolOwner
			poolmarketHash,
			poolmarket.v,
			poolmarket.r,
			poolmarket.s
		));

		return true;
	}



	/*
	function verifyUserMarket(UserMarket usermarket)
	public view returns (bool)
	{
		return usermarket.requester == ecrecover(
			keccak256(
				"\x19Ethereum Signed Message:\n0"
				// "\x19Ethereum Signed Message:\n32",
				// getUserMarketHash(usermarket)
			),
			usermarket.v,
			usermarket.r,
			usermarket.s
		);
	}
	function verifyPoolMarket(PoolMarket poolmarket)
	public view returns (bool)
	{
		return poolmarket.requester == ecrecover(
			keccak256(
				"\x19Ethereum Signed Message:\n0"
				// "\x19Ethereum Signed Message:\n32",
				// getPoolMarketHash(usermarket)
			),
			poolmarket.v,
			poolmarket.r,
			poolmarket.s
		);
	}
	*/





}
