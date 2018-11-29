pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

interface IexecHubInterface
{
	function checkResources(address, address, address)
	external view returns (bool);
}
