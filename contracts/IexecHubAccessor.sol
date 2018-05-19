pragma solidity ^0.4.21;

import './IexecHubInterface.sol';

contract IexecHubAccessor
{
	IexecHubInterface internal iexecHubInterface;

	modifier onlyIexecHub()
	{
		require(msg.sender == address(iexecHubInterface));
		_;
	}

	function IexecHubAccessor(address _iexecHubAddress) public
	{
		require(_iexecHubAddress != address(0));
		iexecHubInterface = IexecHubInterface(_iexecHubAddress);
	}

}
