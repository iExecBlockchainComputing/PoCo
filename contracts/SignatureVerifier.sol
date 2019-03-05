pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;

import "../node_modules/iexec-solidity/contracts/ERC734_KeyManager/IERC734.sol";
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
		return checkIdentity(
			_identity,
			recover(_hash, _signature),
			2 // canceling an order requires ACTION (2) from the owning identity, signature with 2 or 4?
		);

		// CHANGE FOR:
		// bytes32 structhash = toEthTypedStructHash(_hash, EIP712DOMAIN_SEPARATOR);
		// return idendity == recover(structHash, _signature) || IERC1271(identity).isValidSignature(structHash, abi.encodePacked(_signature.r, _signature.s, _signature.v)) == 0x20c13b0b;
	}

}
