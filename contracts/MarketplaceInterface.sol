pragma solidity ^0.4.21;
import './IexecLib.sol';
contract MarketplaceInterface
{
	function createMarketOrder(
		IexecLib.MarketOrderDirectionEnum _direction,
		uint256 _category,
		uint256 _trust,
		uint256 _value,
		address _workerpool,
		uint256 _volume)
	public returns (uint);

	function closeMarketOrder(
		uint256 _marketorderIdx)
	public returns (bool);

	function getMarketOrderValue(
		uint256 _marketorderIdx)
	public view returns(uint256);

	function getMarketOrderWorkerpoolOwner(
		uint256 _marketorderIdx)
	public view returns(address);

	function getMarketOrderCategory(
		uint256 _marketorderIdx)
	public view returns (uint256);

	function getMarketOrderTrust(
		uint256 _marketorderIdx)
	public view returns(uint256);

	function getMarketOrder(
		uint256 _marketorderIdx)
	public view returns(
		IexecLib.MarketOrderDirectionEnum direction,
		uint256 category,       // runtime selection
		uint256 trust,          // for PoCo
		uint256 value,          // value/cost/price
		uint256 volume,         // quantity of instances (total)
		uint256 remaining,      // remaining instances
		address workerpool);    // BID can use null for any
}
