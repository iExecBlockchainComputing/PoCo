pragma solidity ^0.5.5;
pragma experimental ABIEncoderV2;

import "../node_modules/iexec-solidity/contracts/ERC734_KeyManager/IERC734.sol";
import "../node_modules/iexec-solidity/contracts/ERC1271/IERC1271.sol";
import "../node_modules/iexec-solidity/contracts/Libs/ECDSA.sol";

contract SignatureVerifier is ECDSA
{
	function checkIdentity(address _identity, address _candidate, uint256 _purpose)
	internal view returns (bool valid)
	{
		return _identity == _candidate || IERC734(_identity).keyHasPurpose(keccak256(abi.encode(_candidate)), _purpose); // Simple address || Identity contract
	}

	// internal ?
	function verifySignature(
		address                _identity,
		bytes32                _hash,
		ECDSA.signature memory _signature)
	public view returns (bool)
	{
		return recoverCheck(_identity, _hash, _signature) || IERC1271(_identity).isValidSignature(_hash, abi.encodePacked(_signature.r, _signature.s, _signature.v));
	}

	// recoverCheck does not revert if signature has invalid format
	function recoverCheck(address candidate, bytes32 hash, signature memory sign)
	internal pure returns (bool)
	{
		if (sign.v != 27 && sign.v != 28) return false;
		return candidate == ecrecover(hash, sign.v, sign.r, sign.s);
	}

}
