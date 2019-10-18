pragma solidity ^0.5.0;

import "./RegistryEntry.sol";
import "../tools/Once.sol";


contract Dataset is RegistryEntry, Once
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
	constructor() public RegistryEntry(msg.sender) {}

	function setup(
		string  calldata _datasetName,
		bytes   calldata _datasetMultiaddr,
		bytes32          _datasetChecksum)
	external onlyOnce()
	{
		m_datasetName      = _datasetName;
		m_datasetMultiaddr = _datasetMultiaddr;
		m_datasetChecksum  = _datasetChecksum;
	}
}
