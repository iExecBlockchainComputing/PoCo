pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";
import "../tools/ENSTools.sol";


interface ENSReverseRegistration
{
	function registerENS(ENSRegistry, string calldata) external;
}

contract ENSReverseRegistrationDelegate is ENSReverseRegistration, DelegateBase, ENSTools
{
	function registerENS(ENSRegistry ens, string calldata name)
	external onlyOwner()
	{
		_reverseRegistration(ens, name);
	}
}
