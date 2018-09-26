pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./IexecODBLib.sol";

contract TestContract
{
	bytes32 public          EIP712DOMAIN_SEPARATOR;
	bytes32 public constant EIP712DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
	bytes32 public constant DAPPORDER_TYPEHASH    = keccak256("DappOrder(address dapp,uint256 dappprice,uint256 volume,address datarestrict,address poolrestrict,address userrestrict,bytes32 salt)");
	bytes32 public constant DATAORDER_TYPEHASH    = keccak256("DataOrder(address data,uint256 dataprice,uint256 volume,address dapprestrict,address poolrestrict,address userrestrict,bytes32 salt)");
	bytes32 public constant POOLORDER_TYPEHASH    = keccak256("PoolOrder(address pool,uint256 poolprice,uint256 volume,uint256 category,uint256 trust,uint256 tag,address dapprestrict,address datarestrict,address userrestrict,bytes32 salt)");
	bytes32 public constant USERORDER_TYPEHASH    = keccak256("UserOrder(address dapp,uint256 dappmaxprice,address data,uint256 datamaxprice,address pool,uint256 poolmaxprice,address requester,uint256 volume,uint256 category,uint256 trust,uint256 tag,address beneficiary,address callback,string params,bytes32 salt)");

	struct EIP712Domain
	{
		string  name;
		string  version;
		uint256 chainId;
		address verifyingContract;
	}

	function getDomainHash(EIP712Domain _domain)
	public pure returns (bytes32)
	{
		return keccak256(abi.encode( // PACKED ?
			EIP712DOMAIN_TYPEHASH
		, keccak256(bytes(_domain.name))
		, keccak256(bytes(_domain.version))
		, _domain.chainId
		, _domain.verifyingContract
		));
	}

	function getDappOrderHash(IexecODBLib.DappOrder _dapporder)
	public pure returns (bytes32)
	{
		return keccak256(abi.encodePacked(
			DAPPORDER_TYPEHASH
		, _dapporder.dapp
		, _dapporder.dappprice
		, _dapporder.volume
		, _dapporder.datarestrict
		, _dapporder.poolrestrict
		, _dapporder.userrestrict
		, _dapporder.salt
		));
	}
	function getDataOrderHash(IexecODBLib.DataOrder _dataorder)
	public pure returns (bytes32)
	{
		return keccak256(abi.encodePacked(
			DATAORDER_TYPEHASH
		, _dataorder.data
		, _dataorder.dataprice
		, _dataorder.volume
		, _dataorder.dapprestrict
		, _dataorder.poolrestrict
		, _dataorder.userrestrict
		, _dataorder.salt
		));
	}
	function getPoolOrderHash(IexecODBLib.PoolOrder _poolorder)
	public pure returns (bytes32)
	{
		return keccak256(abi.encodePacked(
			POOLORDER_TYPEHASH
		, _poolorder.pool
		, _poolorder.poolprice
		, _poolorder.volume
		, _poolorder.category
		, _poolorder.trust
		, _poolorder.tag
		, _poolorder.dapprestrict
		, _poolorder.datarestrict
		, _poolorder.userrestrict
		, _poolorder.salt
		));
	}
	function getUserOrderHash(IexecODBLib.UserOrder _userorder)
	public pure returns (bytes32)
	{
		return keccak256(abi.encodePacked(
			abi.encodePacked(
				USERORDER_TYPEHASH
			, _userorder.dapp
			, _userorder.dappmaxprice
			, _userorder.data
			, _userorder.datamaxprice
			, _userorder.pool
			, _userorder.poolmaxprice
			, _userorder.requester
			), abi.encodePacked(
				_userorder.volume
			, _userorder.category
			, _userorder.trust
			, _userorder.tag
			, _userorder.beneficiary
			, _userorder.callback
			, keccak256(bytes(_userorder.params))
			, _userorder.salt
			)
		));
	}

	function getDappOrderHashASM(IexecODBLib.DappOrder _dapporder)
	public pure returns (bytes32 hash)
	{
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
	function getDataOrderHashASM(IexecODBLib.DataOrder _dataorder)
	public pure returns (bytes32 hash)
	{
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
	function getPoolOrderHashASM(IexecODBLib.PoolOrder _poolorder)
	public pure returns (bytes32 hash)
	{
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
	function getUserOrderHashASM(IexecODBLib.UserOrder _userorder)
	public pure returns (bytes32 hash)
	{
		// Compute sub-hashes
		bytes32 typeHash = USERORDER_TYPEHASH;
		bytes32 paramsHash = keccak256(_userorder.params);
		assembly {
			// Back up select memory
			let temp1 := mload(sub(_userorder,  32))
			/* let temp2 := mload(add(_userorder, 416)) */
			// Write typeHash and sub-hashes
			mstore(sub(_userorder,  32), typeHash)
			mstore(add(_userorder, 416), paramsHash)
			// Compute hash
			hash := keccak256(sub(_userorder, 32), 512) // 512 = 32 + 480
			// Restore memory
			mstore(sub(_userorder,  32), temp1)
			/* mstore(add(_userorder, 416), temp2) */
		}
	}

	function verifySignature(
		address _signer,
		bytes32 _hash,
		uint8   _v,
		bytes32 _r,
		bytes32 _s)
	public view returns (bool)
	{
		return _signer == ecrecover(keccak256(abi.encodePacked("\x19\x01", EIP712DOMAIN_SEPARATOR, _hash)), _v, _r, _s);
	}

	constructor()
	public
	{
		EIP712DOMAIN_SEPARATOR = getDomainHash(EIP712Domain({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           1,
			verifyingContract: this
		}));
	}

}
