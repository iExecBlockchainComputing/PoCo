pragma solidity ^0.5.0;

import "@ensdomains/ens/contracts/ENS.sol";


interface IReverseRegistrar
{
	function claim(address owner) external returns (bytes32);
	function claimWithResolver(address owner, address resolver) external returns (bytes32);
	function setName(string calldata name) external returns (bytes32);
	function node(address addr) external returns (bytes32);
}

contract ReverseRegistration
{
	bytes32 internal constant ADDR_REVERSE_NODE = 0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2;

	function _setName(address ens, string memory name)
	internal
	{
		IReverseRegistrar(ENS(ens).owner(ADDR_REVERSE_NODE)).setName(name);
	}
}
