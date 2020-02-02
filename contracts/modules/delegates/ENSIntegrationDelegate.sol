pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/ENSIntegration.sol";
import "../../tools/ens/ReverseRegistration.sol";


contract ENSIntegrationDelegate is ENSIntegration, ReverseRegistration, DelegateBase
{
	function setName(address _ens, string calldata _name)
	external onlyOwner()
	{
		_setName(_ens, _name);
	}
}
