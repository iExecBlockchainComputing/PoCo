pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;


interface IexecTokenSpender
{
	function receiveApproval(address,uint256,address,bytes calldata) external returns (bool);
}
