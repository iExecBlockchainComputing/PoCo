pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;

import '../tools/Ownable.sol';

contract Dataset is OwnableImmutable
{
	/**
	 * Members
	 */
	string  public m_datasetName;
	bytes   public m_datasetMultiaddr;
	bytes32 public m_datasetChecksum;

	/**
	 * Constructor
	 */
	constructor(
		address        _datasetOwner,
		string  memory _datasetName,
		bytes   memory _datasetMultiaddr,
		bytes32        _datasetChecksum)
	public
	OwnableImmutable(_datasetOwner)
	{
		m_datasetName      = _datasetName;
		m_datasetMultiaddr = _datasetMultiaddr;
		m_datasetChecksum  = _datasetChecksum;
	}

}
