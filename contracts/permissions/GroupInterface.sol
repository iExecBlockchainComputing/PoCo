pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

library IexecPermission
{
	bytes1 public constant SUBMIT = 0x01;
	bytes1 public constant ACCESS = 0x02;
	bytes1 public constant ADMIN  = 0x04;
}
interface GroupInterface
{
	function viewPermissions(address) external view returns (bytes1);
}
