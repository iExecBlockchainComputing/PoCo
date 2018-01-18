pragma solidity ^0.4.18;

import './IexecHubInterface.sol';

contract IexecHubAccessor
{
	address           private  iexecHubAddress;
	IexecHubInterface internal iexecHubInterface;

	/* event IexecHubTransferred(address indexed previousIexecHub, address indexed newIexecHub); */

	modifier onlyIexecHub()
	{
		require(msg.sender == iexecHubAddress);
		_;
	}
	// TODO: need owner to change hub address → IexecHubInterface is Ownable ?
	/* function changeIexecHubAddress(address _newIexecHubAddress)
	{
		require(_newIexecHubAddress != address(0));
		iexecHubAddress   = _newIexecHubAddress;
		iexecHubInterface = IexecHubInterface(_newIexecHubAddress);
	} */

	function IexecHubAccessor(address _iexecHubAddress) public
	{
		require(_iexecHubAddress != address(0));
		iexecHubAddress   = _iexecHubAddress;
		iexecHubInterface = IexecHubInterface(_iexecHubAddress);
	}
}
