pragma solidity ^0.5.0;

import "../tools/ENSReverseRegistration.sol";
import "./Registry.sol";


contract RegistryEntry is ENSReverseRegistration
{
	IRegistry public registry;

	function initialize(address _registry)
	public
	{
		require(address(registry) == address(0), 'already initialized');
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

	function ENSReverseRegister(address _ens, string calldata _name)
	external onlyOwner()
	{
		_ENSReverseRegister(_ens, _name);
	}
}
