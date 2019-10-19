pragma solidity ^0.5.0;

import "./RegistryEntry.sol";


contract Dataset is RegistryEntry
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
		string  memory _datasetName,
		bytes   memory _datasetMultiaddr,
		bytes32        _datasetChecksum)
	public RegistryEntry(msg.sender)
	{
		m_datasetName      = _datasetName;
		m_datasetMultiaddr = _datasetMultiaddr;
		m_datasetChecksum  = _datasetChecksum;
	}
}
