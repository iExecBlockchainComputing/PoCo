pragma solidity ^0.5.0;

import "./CounterfactualFactory.sol";


contract GenericFactory is CounterfactualFactory
{
	event NewContract(address indexed addr);

	function predictAddress(bytes memory _code, bytes32 _salt)
	public view returns(address)
	{
		return _predictAddress(_code, _salt);
	}

	function createContract(bytes memory _code, bytes32 _salt)
	public returns(address)
	{
		address addr = _create2(_code, _salt);
		emit NewContract(addr);
		return addr;
	}

	function createContractAndCallback(bytes memory _code, bytes32 _salt, bytes memory _callback)
	public returns(address)
	{
		address addr = createContract(_code, _salt);
		// solium-disable-next-line security/no-low-level-calls
		(bool success, bytes memory reason) = addr.call(_callback);
		require(success, string(reason));
		return addr;
	}

}
