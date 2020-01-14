pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;


interface IexecEscrowToken
{
	function () external payable;
	function deposit(uint256) external returns (bool);
	function depositFor(uint256,address) external returns (bool);
	function depositForArray(uint256[] calldata,address[] calldata) external returns (bool);
	function withdraw(uint256) external returns (bool);
	function recover() external returns (uint256);
}