pragma solidity ^0.5.10;

contract CounterfactualFactory
{
	function _create2(bytes memory _code, bytes32 _salt)
	internal returns(address)
	{
		bytes memory code = _code;
		bytes32      salt = _salt;
		address      addr;
		// solium-disable-next-line security/no-inline-assembly
		assembly
		{
			addr := create2(0, add(code, 0x20), mload(code), salt)
			if iszero(extcodesize(addr)) { revert(0, 0) }
		}
		return addr;
	}

	function _predictAddress(bytes memory _code, bytes32 _salt)
	internal view returns (address)
	{
		return address(bytes20(keccak256(abi.encodePacked(
			bytes1(0xff),
			address(this),
			_salt,
			keccak256(_code)
		)) << 0x60));
	}
}
