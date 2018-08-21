pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./Data.sol";
import "./RegistryBase.sol";

contract DataRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreateData(address indexed dataOwner, address indexed data, string dataName, string dataParams);

	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	/**
	 * Data creation
	 */
	function createData(
		address _dataOwner,
		string  _dataName,
		string  _dataParams)
	public /* onlyOwner /*owner == IexecHub*/ returns (Data)
	{
		Data newData = new Data(_dataOwner, _dataName, _dataParams);
		require(insert(newData, _dataOwner));
		emit CreateData(_dataOwner, newData, _dataName, _dataParams);
		return newData;
	}
}
