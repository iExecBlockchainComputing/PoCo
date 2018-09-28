pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

library IexecODBLibOrders
{
	struct signature
	{
		uint8   v;
		bytes32 r;
		bytes32 s;
	}

	// bytes32 public constant EIP712DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
	// bytes32 public constant DAPPORDER_TYPEHASH    = keccak256("DappOrder(address dapp,uint256 dappprice,uint256 volume,address datarestrict,address poolrestrict,address userrestrict,bytes32 salt)");
	// bytes32 public constant DATAORDER_TYPEHASH    = keccak256("DataOrder(address data,uint256 dataprice,uint256 volume,address dapprestrict,address poolrestrict,address userrestrict,bytes32 salt)");
	// bytes32 public constant POOLORDER_TYPEHASH    = keccak256("PoolOrder(address pool,uint256 poolprice,uint256 volume,uint256 category,uint256 trust,uint256 tag,address dapprestrict,address datarestrict,address userrestrict,bytes32 salt)");
	// bytes32 public constant USERORDER_TYPEHASH    = keccak256("UserOrder(address dapp,uint256 dappmaxprice,address data,uint256 datamaxprice,address pool,uint256 poolmaxprice,address requester,uint256 volume,uint256 category,uint256 trust,uint256 tag,address beneficiary,address callback,string params,bytes32 salt)");
	bytes32 public constant EIP712DOMAIN_TYPEHASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;
	bytes32 public constant DAPPORDER_TYPEHASH    = 0x54d6dfd5b0b205c769bfa2e658d0deb04041feb55aa2b45aa83254ecd37fec7f;
	bytes32 public constant DATAORDER_TYPEHASH    = 0xe69a76440c3875f3ffb3612d713679e576cddc58f8dcb10bf74d1950f105c61b;
	bytes32 public constant POOLORDER_TYPEHASH    = 0x83c35d50702bb5cd84ca58dcb61dbd00fb330c574f351202cdabc71a16642252;
	bytes32 public constant USERORDER_TYPEHASH    = 0x9cf6d00e15aa47bf59fe58f2b674c24c51a6942718b382678707689fe95c7185;

	struct EIP712Domain
	{
		string  name;
		string  version;
		uint256 chainId;
		address verifyingContract;
	}
	struct DappOrder
	{
		address dapp;
		uint256 dappprice;
		uint256 volume;
		address datarestrict;
		address poolrestrict;
		address userrestrict;
		bytes32 salt;
		signature sign;
	}
	struct DataOrder
	{
		address data;
		uint256 dataprice;
		uint256 volume;
		address dapprestrict;
		address poolrestrict;
		address userrestrict;
		bytes32 salt;
		signature sign;
	}
	struct PoolOrder
	{
		address pool;
		uint256 poolprice;
		uint256 volume;
		uint256 category;
		uint256 trust;
		uint256 tag;
		address dapprestrict;
		address datarestrict;
		address userrestrict;
		bytes32 salt;
		signature sign;
	}
	struct UserOrder
	{
		address dapp;
		uint256 dappmaxprice;
		address data;
		uint256 datamaxprice;
		address pool;
		uint256 poolmaxprice;
		address requester;
		uint256 volume;
		uint256 category;
		uint256 trust;
		uint256 tag;
		address beneficiary;
		address callback;
		string  params;
		bytes32 salt;
		signature sign;
	}

	function hash(EIP712Domain _domain)
	public pure returns (bytes32 hash)
	{
		/**
		 * Readeable but expensive
		 */
		// return keccak256(abi.encode(
		// 	EIP712DOMAIN_TYPEHASH
		// , keccak256(bytes(_domain.name))
		// , keccak256(bytes(_domain.version))
		// , _domain.chainId
		// , _domain.verifyingContract
		// ));

		// Compute sub-hashes
		bytes32 typeHash    = EIP712DOMAIN_TYPEHASH;
		bytes32 nameHash    = keccak256(bytes(_domain.name));
		bytes32 versionHash = keccak256(bytes(_domain.version));
		assembly {
			// Back up select memory
			let temp1 := mload(sub(_domain, 32))
			let temp2 := mload(add(_domain,  0))
			let temp3 := mload(add(_domain, 32))
			// Write typeHash and sub-hashes
			mstore(sub(_domain, 32),    typeHash)
			mstore(add(_domain,  0),    nameHash)
			mstore(add(_domain, 32), versionHash)
			// Compute hash
			hash := keccak256(sub(_domain, 32), 160) // 160 = 32 + 128
			// Restore memory
			mstore(sub(_domain, 32), temp1)
			mstore(add(_domain,  0), temp2)
			mstore(add(_domain, 32), temp3)
		}
	}
	function hash(DappOrder _dapporder)
	public pure returns (bytes32 hash)
	{
		/**
		 * Readeable but expensive
		 */
		// return keccak256(abi.encode(
		// 	DAPPORDER_TYPEHASH
		// , _dapporder.dapp
		// , _dapporder.dappprice
		// , _dapporder.volume
		// , _dapporder.datarestrict
		// , _dapporder.poolrestrict
		// , _dapporder.userrestrict
		// , _dapporder.salt
		// ));

		// Compute sub-hashes
		bytes32 typeHash = DAPPORDER_TYPEHASH;
		assembly {
			// Back up select memory
			let temp1 := mload(sub(_dapporder, 32))
			// Write typeHash and sub-hashes
			mstore(sub(_dapporder, 32), typeHash)
			// Compute hash
			hash := keccak256(sub(_dapporder, 32), 256) // 256 = 32 + 224
			// Restore memory
			mstore(sub(_dapporder, 32), temp1)
		}
	}
	function hash(DataOrder _dataorder)
	public pure returns (bytes32 hash)
	{
		/**
		 * Readeable but expensive
		 */
		// return keccak256(abi.encode(
		// 	DATAORDER_TYPEHASH
		// , _dataorder.data
		// , _dataorder.dataprice
		// , _dataorder.volume
		// , _dataorder.dapprestrict
		// , _dataorder.poolrestrict
		// , _dataorder.userrestrict
		// , _dataorder.salt
		// ));

		// Compute sub-hashes
		bytes32 typeHash = DATAORDER_TYPEHASH;
		assembly {
			// Back up select memory
			let temp1 := mload(sub(_dataorder, 32))
			// Write typeHash and sub-hashes
			mstore(sub(_dataorder, 32), typeHash)
			// Compute hash
			hash := keccak256(sub(_dataorder, 32), 256) // 256 = 32 + 224
			// Restore memory
			mstore(sub(_dataorder, 32), temp1)
		}
	}
	function hash(PoolOrder _poolorder)
	public pure returns (bytes32 hash)
	{
		/**
		 * Readeable but expensive
		 */
		// return keccak256(abi.encode(
		// 	POOLORDER_TYPEHASH
		// , _poolorder.pool
		// , _poolorder.poolprice
		// , _poolorder.volume
		// , _poolorder.category
		// , _poolorder.trust
		// , _poolorder.tag
		// , _poolorder.dapprestrict
		// , _poolorder.datarestrict
		// , _poolorder.userrestrict
		// , _poolorder.salt
		// ));

		// Compute sub-hashes
		bytes32 typeHash = POOLORDER_TYPEHASH;
		assembly {
			// Back up select memory
			let temp1 := mload(sub(_poolorder, 32))
			// Write typeHash and sub-hashes
			mstore(sub(_poolorder, 32), typeHash)
			// Compute hash
			hash := keccak256(sub(_poolorder, 32), 352) // 352 = 32 + 320
			// Restore memory
			mstore(sub(_poolorder, 32), temp1)
		}
	}
	function hash(UserOrder _userorder)
	public pure returns (bytes32 hash)
	{
		/**
		 * Readeable but expensive
		 */
		//return keccak256(abi.encodePacked(
		//	abi.encode(
		//		USERORDER_TYPEHASH
		//	, _userorder.dapp
		//	, _userorder.dappmaxprice
		//	, _userorder.data
		//	, _userorder.datamaxprice
		//	, _userorder.pool
		//	, _userorder.poolmaxprice
		//	, _userorder.requester
		//	), abi.encode(
		//		_userorder.volume
		//	, _userorder.category
		//	, _userorder.trust
		//	, _userorder.tag
		//	, _userorder.beneficiary
		//	, _userorder.callback
		//	, keccak256(bytes(_userorder.params))
		//	, _userorder.salt
		//	)
		//));

		// Compute sub-hashes
		bytes32 typeHash = USERORDER_TYPEHASH;
		bytes32 paramsHash = keccak256(bytes(_userorder.params));
		assembly {
			// Back up select memory
			let temp1 := mload(sub(_userorder,  32))
			let temp2 := mload(add(_userorder, 416))
			// Write typeHash and sub-hashes
			mstore(sub(_userorder,  32), typeHash)
			mstore(add(_userorder, 416), paramsHash)
			// Compute hash
			hash := keccak256(sub(_userorder, 32), 512) // 512 = 32 + 480
			// Restore memory
			mstore(sub(_userorder,  32), temp1)
			mstore(add(_userorder, 416), temp2)
		}
	}
}
