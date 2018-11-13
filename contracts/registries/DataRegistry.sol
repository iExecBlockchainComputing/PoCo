pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import './Data.sol';
import './RegistryBase.sol';

contract DataRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreateData(
		address indexed dataOwner,
		address data,
		string  dataName,
		string  dataParams,
		bytes32 dataHash);

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
		string  _dataParams,
		bytes32 _dataHash)
	public /* onlyOwner /*owner == IexecHub*/ returns (Data)
	{
		Data newData = new Data(_dataOwner, _dataName, _dataParams, _dataHash);
		require(insert(newData, _dataOwner));
		emit CreateData(_dataOwner, newData, _dataName, _dataParams, _dataHash);
		return newData;
	}
}
