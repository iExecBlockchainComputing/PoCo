pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

contract GroupInterface
{
	function viewPermissions(address) public view returns (bytes1);
}
