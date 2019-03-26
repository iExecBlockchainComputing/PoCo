pragma solidity ^0.5.7;
pragma experimental ABIEncoderV2;

import "../node_modules/iexec-solidity/contracts/ERC734_KeyManager/IERC734.sol";
import "../node_modules/iexec-solidity/contracts/ERC1271/IERC1271.sol";

contract SignatureVerifier
{
	function checkIdentity(address _identity, address _candidate, uint256 _purpose)
	internal view returns (bool valid)
	{
		return _identity == _candidate || IERC734(_identity).keyHasPurpose(keccak256(abi.encode(_candidate)), _purpose); // Simple address || ERC 734 identity contract
	}

	// internal ?
	function verifySignature(
		address      _identity,
		bytes32      _hash,
		bytes memory _signature)
	public view returns (bool)
	{
		return recoverCheck(_identity, _hash, _signature) || IERC1271(_identity).isValidSignature(_hash, _signature);
	}

	// recoverCheck does not revert if signature has invalid format
	function recoverCheck(address candidate, bytes32 hash, bytes memory sign)
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
		return candidate == ecrecover(hash, v, r, s);
	}

	function toEthSignedMessageHash(bytes32 hash)
	internal pure returns (bytes32)
	{
		return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
	}
}
