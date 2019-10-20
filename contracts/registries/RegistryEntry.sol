pragma solidity ^0.5.0;

import "../tools/ENSReverseRegistration.sol";
import "./Registry.sol";


contract RegistryEntry is ENSReverseRegistration
{
	IRegistry public registry;

	/**
	 * Constructor
	 */
	constructor(address _registry)
	public
	{
		registry = IRegistry(_registry);
	}

	function owner() public view returns (address)
	{
		return registry.ownerOf(uint256(address(this)));
	}
}
