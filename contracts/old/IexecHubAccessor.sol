pragma solidity ^0.4.21;

import './IexecHubInterface.sol';

contract IexecHubAccessor
{
	address           internal iexecHubAddress;
	IexecHubInterface internal iexecHubInterface;

	modifier onlyIexecHub()
	{
		require(msg.sender == iexecHubAddress);
		_;
	}

	function IexecHubAccessor(address _iexecHubAddress) public
	{
		require(_iexecHubAddress != address(0));
		iexecHubAddress   = _iexecHubAddress;
		iexecHubInterface = IexecHubInterface(_iexecHubAddress);
	}

}
