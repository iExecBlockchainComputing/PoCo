pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "iexec-solidity/contracts/ERC734_KeyManager/IERC734.sol";
import "iexec-solidity/contracts/ERC1271/IERC1271.sol";


contract SignatureVerifier
{
	function addrToKey(address _addr)
	internal pure returns (bytes32)
	{
		return bytes32(uint256(_addr));
	}

	function checkIdentity(address _identity, address _candidate, uint256 _purpose)
	internal view returns (bool valid)
	{
		return _identity == _candidate || IERC734(_identity).keyHasPurpose(addrToKey(_candidate), _purpose); // Simple address || ERC 734 identity contract
	}

	function checkSignature(
		address      _identity,
		bytes32      _hash,
		bytes memory _signature)
	internal view returns (bool)
	{
		return isValidSignature(_identity, _hash, _signature) || IERC1271(_identity).isValidSignature(_hash, _signature);
	}

	// Does not revert if signature has invalid format
	function isValidSignature(address signer, bytes32 hash, bytes memory sign)
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
