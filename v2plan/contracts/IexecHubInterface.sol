pragma solidity ^0.4.18;
/* import './IexecHub.sol'; */

contract IexecHubInterface
{
	address internal iexecHubAddress;
	/* address internal iexecHub; */

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
		iexecHubAddress = _newIexecHubAddress;
		iexecHub        = IexecHub(_newIexecHubAddress);
	} */

	function IexecHubInterface(address _iexecHubAddress)
	{
		require(_iexecHubAddress != address(0));
		iexecHubAddress = _iexecHubAddress;
		/* iexecHub        = IexecHub(_iexecHubAddress); */
	}
}
