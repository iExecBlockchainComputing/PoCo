pragma solidity ^0.5.5;

interface IexecHubInterface
{
	function checkResources(address, address, address)
	external view returns (bool);
}
