pragma solidity ^0.5.0;

import "../tools/ENSReverseRegistration.sol";
import "./Registry.sol";


contract RegistryEntry is ENSReverseRegistration
{
	IRegistry public registry;

	constructor(address _registry)
	public
	{
		registry = IRegistry(_registry);
	}

	function owner() public view returns (address)
	{
		return registry.ownerOf(uint256(address(this)));
	}

	modifier onlyOwner()
	{
		require(owner() == msg.sender, 'caller is not the owner');
		_;
	}

	function ENSReverseRegister(ENSRegistry _ens, string calldata _name)
	external onlyOwner()
	{
		_ENSReverseRegister(_ens, _name);
	}
}
