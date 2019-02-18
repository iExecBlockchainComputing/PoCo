pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;

interface IexecHubInterface
{
	function checkResources(address, address, address)
	external view returns (bool);
}
