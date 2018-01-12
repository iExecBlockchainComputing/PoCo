pragma solidity ^0.4.18;
import './IexecHub.sol';

contract iexecHubOwnable
{
	address public   owner;
	address internal iexecHubAddress;
	address internal iexecHub;

	modifier onlyOwner()
	{
		require(msg.sender == owner);
		_;
	}
	modifier onlyIexecHub()
	{
		require(msg.sender == iexecHubAddress);
		_;
	}
	function transferOwnership(address _newOwner) public onlyOwner
	{
		require(_newOwner != 0x0);
		owner = _newOwner;
	}
	function setIexecHubAddress(address _newIexecHubAddress) public onlyOwner
	{
		require(_newIexecHubAddress != 0x0);
		iexecHubAddress = _newIexecHubAddress;
		iexecHub        = IexecHub(_newIexecHubAddress);
	}

	function iexecHubOwnable(address _owner, address _iexecHubAddress)
	{
		require(_owner           != 0x0);
		require(_iexecHubAddress != 0x0);
		owner           = _owner;
		iexecHubAddress = _iexecHubAddress;
		iexecHub        = IexecHub(_iexecHubAddress);
	}
}
