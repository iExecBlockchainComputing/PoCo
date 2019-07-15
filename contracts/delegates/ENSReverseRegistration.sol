pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "@ensdomains/ens/contracts/ENSRegistry.sol";
import "@ensdomains/ens/contracts/ReverseRegistrar.sol";

import "./DelegateBase.sol";


interface ENSReverseRegistration
{
	function registerENS(ENSRegistry, string calldata) external;
}

contract ENSReverseRegistrationDelegate is ENSReverseRegistration, DelegateBase
{
	bytes32 internal constant ADDR_REVERSE_NODE = 0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2;

	function registerENS(ENSRegistry ens, string calldata name)
	external onlyOwner()
	{
		ReverseRegistrar(ens.owner(ADDR_REVERSE_NODE)).setName(name);
	}
}
