pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./Data.sol";
import "./HubBase.sol";

contract DataHub is HubBase
{
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
	public onlyOwner /*owner == IexecHub*/ returns (Data)
	{
		Data newData = new Data(_dataOwner, _dataName, _dataParams);
		require(insert(newData, _dataOwner));
		return newData;
	}
}
