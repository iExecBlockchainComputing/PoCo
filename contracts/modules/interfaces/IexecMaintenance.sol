pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;


interface IexecMaintenance
{
	function configure(address,string calldata,string calldata,uint8,address,address,address,address) external;
	function updateChainId(uint256) external;
	function importScore(address) external;
}
