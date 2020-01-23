pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../libs/IexecODBLibOrders_v4.sol";


interface IexecMaintenance
{
	function configure(address,string calldata,string calldata,uint8,address,address,address,address) external;
	function domain() external view returns (IexecODBLibOrders_v4.EIP712Domain memory);
	function updateDomainSeparator() external;
	function importScore(address) external;
	function setTeeBroker(address) external;
}
