pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;


contract GroupInterface
{
	bytes1 public constant PERMISSION_SUBMIT = 0x01;
	bytes1 public constant PERMISSION_ACCESS = 0x02;
	bytes1 public constant PERMISSION_ADMIN  = 0x04;

	function viewPermissions(address) public view returns (bytes1);
}
