pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/ENSIntegration.sol";
import "../../tools/ENSReverseRegistration.sol";


contract ENSIntegrationDelegate is ENSIntegration, ENSReverseRegistration, DelegateBase
{
	function ENSReverseRegister(address _ens, string calldata _name)
	external onlyOwner()
	{
		_ENSReverseRegister(ENSRegistry(_ens), _name);
	}
}
