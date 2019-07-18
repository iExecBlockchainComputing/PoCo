pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";
import "../libs/ENSTools.sol";


interface ENSReverseRegistration
{
	function registerENS(ENSRegistry, string calldata) external;
}

contract ENSReverseRegistrationDelegate is ENSReverseRegistration, DelegateBase
{
	function registerENS(ENSRegistry ens, string calldata name)
	external onlyOwner()
	{
		ENSTools.reverseRegistration(ens, name);
	}
}
