pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "iexec-solidity/contracts/ERC734_KeyManager/IERC734.sol";
import "iexec-solidity/contracts/ERC1271/IERC1271.sol";
import "../DelegateBase.sol";


contract SignatureVerifier is DelegateBase
{
	function _addrToKey(address _addr)
	internal pure returns (bytes32)
	{
		return bytes32(uint256(_addr));
	}

	function _checkIdentity(address _identity, address _candidate, uint256 _purpose)
	internal view returns (bool valid)
	{
		return _identity == _candidate || IERC734(_identity).keyHasPurpose(_addrToKey(_candidate), _purpose); // Simple address || ERC 734 identity contract
	}

	function _checkSignature(address _identity, bytes32 _hash, bytes memory _signature)
	internal view returns (bool)
	{
		return _isValidSignature(_identity, _hash, _signature) || IERC1271(_identity).isValidSignature(_hash, _signature);
	}

	function _checkPresignature(address _identity, bytes32 _hash)
	internal view returns (bool)
	{
		return _identity != address(0) && _identity == m_presigned[_hash];
	}

	function _checkPresignatureOrSignature(address _identity, bytes32 _hash, bytes memory _signature)
	internal view returns (bool)
	{
		return _checkPresignature(_identity, _hash) || _checkSignature(_identity, _hash, _signature);
	}

	// Does not revert if signature has invalid format
	function _isValidSignature(address signer, bytes32 hash, bytes memory sign)
	internal pure returns (bool)
	{
		bytes32 r;
		bytes32 s;
		uint8   v;
		if (sign.length != 65) return false;
		assembly
		{
			r :=         mload(add(sign, 0x20))
			s :=         mload(add(sign, 0x40))
			v := byte(0, mload(add(sign, 0x60)))
		}
		if (v < 27) v += 27;
		if (v != 27 && v != 28) return false;
		return signer == ecrecover(hash, v, r, s);
	}
}
