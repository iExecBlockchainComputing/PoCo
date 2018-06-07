pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

contract IexecHubInterface
{
	function checkResources(address, address, address)
	public view returns (bool);

	function initialize(bytes32)
	public;
}
