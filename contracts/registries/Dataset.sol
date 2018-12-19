pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import '../tools/Ownable.sol';

contract Dataset is OwnableImmutable
{
	/**
	 * Members
	 */
	string  public m_datasetName;
	bytes   public m_datasetMultiaddr;

	/**
	 * Constructor
	 */
	constructor(
		address        _datasetOwner,
		string  memory _datasetName,
		bytes   memory _datasetMultiaddr)
	public
	OwnableImmutable(_datasetOwner)
	{
		m_datasetName      = _datasetName;
		m_datasetMultiaddr = _datasetMultiaddr;
	}

}
