pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

library IexecODBLibOrders
{
	struct signature
	{
		uint8   v;
		bytes32 r;
		bytes32 s;
	}

	bytes32 public constant    EIP712DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
	bytes32 public constant        APPORDER_TYPEHASH = keccak256("AppOrder(address app,uint256 appprice,uint256 volume,uint256 tag,address datasetrestrict,address workerpoolrestrict,address requesterrestrict,bytes32 salt)");
	bytes32 public constant    DATASETORDER_TYPEHASH = keccak256("DatasetOrder(address dataset,uint256 datasetprice,uint256 volume,uint256 tag,address apprestrict,address workerpoolrestrict,address requesterrestrict,bytes32 salt)");
	bytes32 public constant WORKERPOOLORDER_TYPEHASH = keccak256("WorkerpoolOrder(address workerpool,uint256 workerpoolprice,uint256 volume,uint256 tag,uint256 category,uint256 trust,address apprestrict,address datasetrestrict,address requesterrestrict,bytes32 salt)");
	bytes32 public constant       USERORDER_TYPEHASH = keccak256("UserOrder(address app,uint256 appmaxprice,address dataset,uint256 datasetmaxprice,address workerpool,uint256 workerpoolmaxprice,address requester,uint256 volume,uint256 tag,uint256 category,uint256 trust,address beneficiary,address callback,string params,bytes32 salt)");
	// bytes32 public constant    EIP712DOMAIN_TYPEHASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;
	// bytes32 public constant        APPORDER_TYPEHASH = 0x659fc082754b0da79509e75c6726055cbe84eb7527b278418c8a5998b1ce40c3;
	// bytes32 public constant    DATASETORDER_TYPEHASH = 0x25152fa69720eec3b3360dd907576b7ec55e2633342bf993e09e8f5148640930;
	// bytes32 public constant WORKERPOOLORDER_TYPEHASH = 0x03b4801c105a2678088a8300a3e19699cc783e5a43439f28f3bc75b8391552ea;
	// bytes32 public constant       USERORDER_TYPEHASH = 0x8160ee616648fd072bd2f7da47db26c4adbeb9f3f44e6d6cad0fc6f011f2fbbf;

	struct EIP712Domain
	{
		string  name;
		string  version;
		uint256 chainId;
		address verifyingContract;
	}
	struct AppOrder
	{
		address app;
		uint256 appprice;
		uint256 volume;
		uint256 tag;
		address datasetrestrict;
		address workerpoolrestrict;
		address requesterrestrict;
		bytes32 salt;
		signature sign;
	}
	struct DatasetOrder
	{
		address dataset;
		uint256 datasetprice;
		uint256 volume;
		uint256 tag;
		address apprestrict;
		address workerpoolrestrict;
		address requesterrestrict;
		bytes32 salt;
		signature sign;
	}
	struct WorkerpoolOrder
	{
		address workerpool;
		uint256 workerpoolprice;
		uint256 volume;
		uint256 tag;
		uint256 category;
		uint256 trust;
		address apprestrict;
		address datasetrestrict;
		address requesterrestrict;
		bytes32 salt;
		signature sign;
	}
	struct UserOrder
	{
		address app;
		uint256 appmaxprice;
		address dataset;
		uint256 datasetmaxprice;
		address workerpool;
		uint256 workerpoolmaxprice;
		address requester;
		uint256 volume;
		uint256 tag;
		uint256 category;
		uint256 trust;
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
	function hash(AppOrder _apporder)
	public pure returns (bytes32 hash)
	{
		/**
		 * Readeable but expensive
		 */
		// return keccak256(abi.encode(
		// 	APPORDER_TYPEHASH
		// , _apporder.app
		// , _apporder.appprice
		// , _apporder.volume
		// , _apporder.tag
		// , _apporder.datasetrestrict
		// , _apporder.workerpoolrestrict
		// , _apporder.requesterrestrict
		// , _apporder.salt
		// ));

		// Compute sub-hashes
		bytes32 typeHash = APPORDER_TYPEHASH;
		assembly {
			// Back up select memory
			let temp1 := mload(sub(_apporder, 32))
			// Write typeHash and sub-hashes
			mstore(sub(_apporder, 32), typeHash)
			// Compute hash
			hash := keccak256(sub(_apporder, 32), 288) // 288 = 32 + 256
			// Restore memory
			mstore(sub(_apporder, 32), temp1)
		}
	}
	function hash(DatasetOrder _datasetorder)
	public pure returns (bytes32 hash)
	{
		/**
		 * Readeable but expensive
		 */
		// return keccak256(abi.encode(
		// 	DATASETORDER_TYPEHASH
		// , _datasetorder.dataset
		// , _datasetorder.datasetprice
		// , _datasetorder.volume
		// , _datasetorder.tag
		// , _datasetorder.apprestrict
		// , _datasetorder.workerpoolrestrict
		// , _datasetorder.requesterrestrict
		// , _datasetorder.salt
		// ));

		// Compute sub-hashes
		bytes32 typeHash = DATASETORDER_TYPEHASH;
		assembly {
			// Back up select memory
			let temp1 := mload(sub(_datasetorder, 32))
			// Write typeHash and sub-hashes
			mstore(sub(_datasetorder, 32), typeHash)
			// Compute hash
			hash := keccak256(sub(_datasetorder, 32), 288) // 288 = 32 + 256
			// Restore memory
			mstore(sub(_datasetorder, 32), temp1)
		}
	}
	function hash(WorkerpoolOrder _workerpoolorder)
	public pure returns (bytes32 hash)
	{
		/**
		 * Readeable but expensive
		 */
		// return keccak256(abi.encode(
		// 	WORKERPOOLORDER_TYPEHASH
		// , _workerpoolorder.workerpool
		// , _workerpoolorder.workerpoolprice
		// , _workerpoolorder.volume
		// , _workerpoolorder.tag
		// , _workerpoolorder.category
		// , _workerpoolorder.trust
		// , _workerpoolorder.apprestrict
		// , _workerpoolorder.datasetrestrict
		// , _workerpoolorder.requesterrestrict
		// , _workerpoolorder.salt
		// ));

		// Compute sub-hashes
		bytes32 typeHash = WORKERPOOLORDER_TYPEHASH;
		assembly {
			// Back up select memory
			let temp1 := mload(sub(_workerpoolorder, 32))
			// Write typeHash and sub-hashes
			mstore(sub(_workerpoolorder, 32), typeHash)
			// Compute hash
			hash := keccak256(sub(_workerpoolorder, 32), 352) // 352 = 32 + 320
			// Restore memory
			mstore(sub(_workerpoolorder, 32), temp1)
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
		//	, _userorder.app
		//	, _userorder.appmaxprice
		//	, _userorder.dataset
		//	, _userorder.datasetmaxprice
		//	, _userorder.workerpool
		//	, _userorder.workerpoolmaxprice
		//	, _userorder.requester
		//	, _userorder.volume
		//	, _userorder.tag
		//	, _userorder.category
		//	, _userorder.trust
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
