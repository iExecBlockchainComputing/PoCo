pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import '../tools/Ownable.sol';

contract Data is OwnableImmutable
{
	/**
	 * Members
	 */
	string  public m_dataName;
	string  public m_dataParams;
	bytes32 public m_dataHash;

	/**
	 * Constructor
	 */
	constructor(
		address _dataOwner,
		string  _dataName,
		string  _dataParams,
		bytes32 _dataHash)
	public
	OwnableImmutable(_dataOwner)
	{
		m_dataName   = _dataName;
		m_dataParams = _dataParams;
		m_dataHash   = _dataHash;
	}

}
