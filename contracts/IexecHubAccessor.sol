pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./IexecHubInterface.sol";

contract IexecHubAccessor
{
	IexecHubInterface public iexechub;

	modifier onlyIexecHub()
	{
		require(msg.sender == address(iexechub));
		_;
	}

	constructor(address _iexechub)
	public
	{
		require(_iexechub != address(0));
		iexechub = IexecHubInterface(_iexechub);
	}

}
