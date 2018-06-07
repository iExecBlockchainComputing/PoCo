pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import '../tools/OwnableOZ.sol';

contract Data is OwnableOZ//, IexecHubAccessor
{

	/**
	 * Members
	 */
	string public m_dataName;
	string public m_dataParams;

	/**
	 * Constructor
	 */
	constructor(
		address _dataOwner,
		string  _dataName,
		string  _dataParams)
	public
	{
		transferOwnership(_dataOwner);
		m_dataName   = _dataName;
		m_dataParams = _dataParams;
	}

}
