pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

interface IexecHubInterface
{
	function checkResources(address, address, address)
	public view returns (bool);
}
