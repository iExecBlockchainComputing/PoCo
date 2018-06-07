pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import '../tools/Ownable.sol';

contract Data is OwnableImmutable
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
	OwnableImmutable(_dataOwner)
	{
		m_dataName   = _dataName;
		m_dataParams = _dataParams;
	}

}
