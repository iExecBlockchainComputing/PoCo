pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";
import "../tools/ENSReverseRegistration.sol";


interface ENSIntegration
{
	function ENSReverseRegister(ENSRegistry ens, string calldata name) external;
}

contract ENSIntegrationDelegate is ENSIntegration, ENSReverseRegistration, DelegateBase
{
	function ENSReverseRegister(ENSRegistry _ens, string calldata _name)
	external onlyOwner()
	{
		_ENSReverseRegister(_ens, _name);
	}
}
