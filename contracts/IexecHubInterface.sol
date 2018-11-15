pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

interface IexecHubInterface
{
	function checkResources(address, address, address)
	public view returns (bool);
}
