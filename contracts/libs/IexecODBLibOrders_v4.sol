pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;


library IexecODBLibOrders_v4
{
	// bytes32 public constant             EIP712DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
	// bytes32 public constant                 APPORDER_TYPEHASH = keccak256("AppOrder(address app,uint256 appprice,uint256 volume,bytes32 tag,address datasetrestrict,address workerpoolrestrict,address requesterrestrict,bytes32 salt)");
	// bytes32 public constant             DATASETORDER_TYPEHASH = keccak256("DatasetOrder(address dataset,uint256 datasetprice,uint256 volume,bytes32 tag,address apprestrict,address workerpoolrestrict,address requesterrestrict,bytes32 salt)");
	// bytes32 public constant          WORKERPOOLORDER_TYPEHASH = keccak256("WorkerpoolOrder(address workerpool,uint256 workerpoolprice,uint256 volume,bytes32 tag,uint256 category,uint256 trust,address apprestrict,address datasetrestrict,address requesterrestrict,bytes32 salt)");
	// bytes32 public constant             REQUESTORDER_TYPEHASH = keccak256("RequestOrder(address app,uint256 appmaxprice,address dataset,uint256 datasetmaxprice,address workerpool,uint256 workerpoolmaxprice,address requester,uint256 volume,bytes32 tag,uint256 category,uint256 trust,address beneficiary,address callback,string params,bytes32 salt)");
	// bytes32 public constant        APPORDEROPERATION_TYPEHASH = keccak256("AppOrderOperation(AppOrder order,uint256 operation)AppOrder(address app,uint256 appprice,uint256 volume,bytes32 tag,address datasetrestrict,address workerpoolrestrict,address requesterrestrict,bytes32 salt)");
	// bytes32 public constant    DATASETORDEROPERATION_TYPEHASH = keccak256("DatasetOrderOperation(DatasetOrder order,uint256 operation)DatasetOrder(address dataset,uint256 datasetprice,uint256 volume,bytes32 tag,address apprestrict,address workerpoolrestrict,address requesterrestrict,bytes32 salt)");
	// bytes32 public constant WORKERPOOLORDEROPERATION_TYPEHASH = keccak256("WorkerpoolOrderOperation(WorkerpoolOrder order,uint256 operation)WorkerpoolOrder(address workerpool,uint256 workerpoolprice,uint256 volume,bytes32 tag,uint256 category,uint256 trust,address apprestrict,address datasetrestrict,address requesterrestrict,bytes32 salt)");
	// bytes32 public constant    REQUESTORDEROPERATION_TYPEHASH = keccak256("RequestOrderOperation(RequestOrder order,uint256 operation)RequestOrder(address app,uint256 appmaxprice,address dataset,uint256 datasetmaxprice,address workerpool,uint256 workerpoolmaxprice,address requester,uint256 volume,bytes32 tag,uint256 category,uint256 trust,address beneficiary,address callback,string params,bytes32 salt)");
	bytes32 public constant             EIP712DOMAIN_TYPEHASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;
	bytes32 public constant                 APPORDER_TYPEHASH = 0x60815a0eeec47dddf1615fe53b31d016c31444e01b9d796db365443a6445d008;
	bytes32 public constant             DATASETORDER_TYPEHASH = 0x6cfc932a5a3d22c4359295b9f433edff52b60703fa47690a04a83e40933dd47c;
	bytes32 public constant          WORKERPOOLORDER_TYPEHASH = 0xaa3429fb281b34691803133d3d978a75bb77c617ed6bc9aa162b9b30920022bb;
	bytes32 public constant             REQUESTORDER_TYPEHASH = 0xf24e853034a3a450aba845a82914fbb564ad85accca6cf62be112a154520fae0;
	bytes32 public constant        APPORDEROPERATION_TYPEHASH = 0x0638bb0702457e2b4b01be8a202579b8bf97e587fb4f2cc4d4aad01f21a06ee0;
	bytes32 public constant    DATASETORDEROPERATION_TYPEHASH = 0x075eb6f7578ff4292c241bd2484cd5c1d5e6ecc2ddd3317e1d8176b5a45865ec;
	bytes32 public constant WORKERPOOLORDEROPERATION_TYPEHASH = 0x322d980b7d7a6a1f7c39ff0c5445da6ae1d8e0393ff0dd468c8be3e2c8644388;
	bytes32 public constant    REQUESTORDEROPERATION_TYPEHASH = 0x0ded7b52c2d77595a40d242eca751df172b18e686326dbbed3f4748828af77c7;

	enum OrderOperationEnum
	{
		SIGN,
		CLOSE
	}
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
		bytes32 tag;
		address datasetrestrict;
		address workerpoolrestrict;
		address requesterrestrict;
		bytes32 salt;
		bytes   sign;
	}
	struct DatasetOrder
	{
		address dataset;
		uint256 datasetprice;
		uint256 volume;
		bytes32 tag;
		address apprestrict;
		address workerpoolrestrict;
		address requesterrestrict;
		bytes32 salt;
		bytes   sign;
	}
	struct WorkerpoolOrder
	{
		address workerpool;
		uint256 workerpoolprice;
		uint256 volume;
		bytes32 tag;
		uint256 category;
		uint256 trust;
		address apprestrict;
		address datasetrestrict;
		address requesterrestrict;
		bytes32 salt;
		bytes   sign;
	}
	struct RequestOrder
	{
		address app;
		uint256 appmaxprice;
		address dataset;
		uint256 datasetmaxprice;
		address workerpool;
		uint256 workerpoolmaxprice;
		address requester;
		uint256 volume;
		bytes32 tag;
		uint256 category;
		uint256 trust;
		address beneficiary;
		address callback;
		string  params;
		bytes32 salt;
		bytes   sign;
	}
	struct AppOrderOperation
	{
		AppOrder           order;
		OrderOperationEnum operation;
		bytes              sign;
	}
	struct DatasetOrderOperation
	{
		DatasetOrder       order;
		OrderOperationEnum operation;
		bytes              sign;
	}
	struct WorkerpoolOrderOperation
	{
		WorkerpoolOrder    order;
		OrderOperationEnum operation;
		bytes              sign;
	}
	struct RequestOrderOperation
	{
		RequestOrder       order;
		OrderOperationEnum operation;
		bytes              sign;
	}

	function hash(EIP712Domain memory _domain)
	public pure returns (bytes32 domainhash)
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
			let temp1 := mload(sub(_domain, 0x20))
			let temp2 := mload(add(_domain, 0x00))
			let temp3 := mload(add(_domain, 0x20))
			// Write typeHash and sub-hashes
			mstore(sub(_domain, 0x20),    typeHash)
			mstore(add(_domain, 0x00),    nameHash)
			mstore(add(_domain, 0x20), versionHash)
			// Compute hash
			domainhash := keccak256(sub(_domain, 0x20), 0xA0) // 160 = 32 + 128
			// Restore memory
			mstore(sub(_domain, 0x20), temp1)
			mstore(add(_domain, 0x00), temp2)
			mstore(add(_domain, 0x20), temp3)
		}
	}
	function hash(AppOrder memory _apporder)
	public pure returns (bytes32 apphash)
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
			let temp1 := mload(sub(_apporder, 0x20))
			// Write typeHash and sub-hashes
			mstore(sub(_apporder, 0x20), typeHash)
			// Compute hash
			apphash := keccak256(sub(_apporder, 0x20), 0x120) // 288 = 32 + 256
			// Restore memory
			mstore(sub(_apporder, 0x20), temp1)
		}
	}
	function hash(DatasetOrder memory _datasetorder)
	public pure returns (bytes32 datasethash)
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
			let temp1 := mload(sub(_datasetorder, 0x20))
			// Write typeHash and sub-hashes
			mstore(sub(_datasetorder, 0x20), typeHash)
			// Compute hash
			datasethash := keccak256(sub(_datasetorder, 0x20), 0x120) // 288 = 32 + 256
			// Restore memory
			mstore(sub(_datasetorder, 0x20), temp1)
		}
	}
	function hash(WorkerpoolOrder memory _workerpoolorder)
	public pure returns (bytes32 workerpoolhash)
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
			let temp1 := mload(sub(_workerpoolorder, 0x20))
			// Write typeHash and sub-hashes
			mstore(sub(_workerpoolorder, 0x20), typeHash)
			// Compute hash
			workerpoolhash := keccak256(sub(_workerpoolorder, 0x20), 0x160) // 352 = 32 + 320
			// Restore memory
			mstore(sub(_workerpoolorder, 0x20), temp1)
		}
	}
	function hash(RequestOrder memory _requestorder)
	public pure returns (bytes32 requesthash)
	{
		/**
		 * Readeable but expensive
		 */
		//return keccak256(abi.encodePacked(
		//	abi.encode(
		//		REQUESTORDER_TYPEHASH
		//	, _requestorder.app
		//	, _requestorder.appmaxprice
		//	, _requestorder.dataset
		//	, _requestorder.datasetmaxprice
		//	, _requestorder.workerpool
		//	, _requestorder.workerpoolmaxprice
		//	, _requestorder.requester
		//	, _requestorder.volume
		//	, _requestorder.tag
		//	, _requestorder.category
		//	, _requestorder.trust
		//	, _requestorder.beneficiary
		//	, _requestorder.callback
		//	, keccak256(bytes(_requestorder.params))
		//	, _requestorder.salt
		//	)
		//));

		// Compute sub-hashes
		bytes32 typeHash = REQUESTORDER_TYPEHASH;
		bytes32 paramsHash = keccak256(bytes(_requestorder.params));
		assembly {
			// Back up select memory
			let temp1 := mload(sub(_requestorder, 0x020))
			let temp2 := mload(add(_requestorder, 0x1A0))
			// Write typeHash and sub-hashes
			mstore(sub(_requestorder, 0x020), typeHash)
			mstore(add(_requestorder, 0x1A0), paramsHash)
			// Compute hash
			requesthash := keccak256(sub(_requestorder, 0x20), 0x200) // 512 = 32 + 480
			// Restore memory
			mstore(sub(_requestorder, 0x020), temp1)
			mstore(add(_requestorder, 0x1A0), temp2)
		}
	}
	function hash(AppOrderOperation memory _apporderoperation)
	public pure returns (bytes32)
	{
		return keccak256(abi.encode(
			APPORDEROPERATION_TYPEHASH,
			hash(_apporderoperation.order),
			_apporderoperation.operation
		));
	}
	function hash(DatasetOrderOperation memory _datasetorderoperation)
	public pure returns (bytes32)
	{
		return keccak256(abi.encode(
			DATASETORDEROPERATION_TYPEHASH,
			hash(_datasetorderoperation.order),
			_datasetorderoperation.operation
		));
	}
	function hash(WorkerpoolOrderOperation memory _workerpoolorderoperation)
	public pure returns (bytes32)
	{
		return keccak256(abi.encode(
			WORKERPOOLORDEROPERATION_TYPEHASH,
			hash(_workerpoolorderoperation.order),
			_workerpoolorderoperation.operation
		));
	}
	function hash(RequestOrderOperation memory _requestorderoperation)
	public pure returns (bytes32)
	{
		return keccak256(abi.encode(
			REQUESTORDEROPERATION_TYPEHASH,
			hash(_requestorderoperation.order),
			_requestorderoperation.operation
		));
	}

	function toEthSignedMessageHash(bytes32 _msgHash)
	public pure returns (bytes32)
	{
		return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _msgHash));
	}

	function toEthTypedStructHash(bytes32 _structHash, bytes32 _domainHash)
	public pure returns (bytes32 typedStructHash)
	{
		return keccak256(abi.encodePacked("\x19\x01", _domainHash, _structHash));
	}

	function recover(bytes32 _hash, bytes memory _sign)
	public pure returns (address)
	{
		bytes32 r;
		bytes32 s;
		uint8   v;
		require(_sign.length == 65);
		assembly
		{
			r :=         mload(add(_sign, 0x20))
			s :=         mload(add(_sign, 0x40))
			v := byte(0, mload(add(_sign, 0x60)))
		}
		if (v < 27) v += 27;
		require(v == 27 || v == 28);
		return ecrecover(_hash, v, r, s);
	}
}
