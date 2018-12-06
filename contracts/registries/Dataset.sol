pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import '../tools/Ownable.sol';

contract Dataset is OwnableImmutable
{
	/**
	 * Members
	 */
	string  public m_datasetName;
	string  public m_datasetParams;
	bytes32 public m_datasetHash;

	/**
	 * Constructor
	 */
	constructor(
		address        _datasetOwner,
		string  memory _datasetName,
		string  memory _datasetParams,
		bytes32        _datasetHash)
	public
	OwnableImmutable(_datasetOwner)
	{
		m_datasetName   = _datasetName;
		m_datasetParams = _datasetParams;
		m_datasetHash   = _datasetHash;
	}

}
