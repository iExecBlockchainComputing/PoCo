pragma solidity ^0.5.0;

import "./Registry.sol";
import "../tools/ens/ReverseRegistration.sol";


contract RegistryEntry is ReverseRegistration
{
	IRegistry public registry;

	constructor() internal {}

	function _initialize(address _registry) internal
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

	function setName(address _ens, string calldata _name)
	external onlyOwner()
	{
		_setName(_ens, _name);
	}
}
