pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";
import "../tools/ENSReverseRegistrationOwnable.sol";


interface ENSIntegration
{
	function registerENS(ENSRegistry, string calldata) external;
}

contract ENSIntegrationDelegate is ENSIntegration, ENSReverseRegistrationOwnable, DelegateBase
{
}
