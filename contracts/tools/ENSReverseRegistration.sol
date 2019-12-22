pragma solidity ^0.5.0;

import "@ensdomains/ens/contracts/ENS.sol";
import "@ensdomains/ens/contracts/ReverseRegistrar.sol";


contract ENSReverseRegistration
{
	bytes32 internal constant ADDR_REVERSE_NODE = 0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2;

	function _ENSReverseRegister(address ens, string memory name)
	internal
	{
		ReverseRegistrar(ENS(ens).owner(ADDR_REVERSE_NODE)).setName(name);
	}
}
