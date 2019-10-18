pragma solidity ^0.5.0;

import "./RegistryEntry.sol";
import "../tools/Once.sol";


contract App is RegistryEntry, Once
{
	/**
	 * Members
	 */
	string  public  m_appName;
	string  public  m_appType;
	bytes   public  m_appMultiaddr;
	bytes32 public  m_appChecksum;
	bytes   public  m_appMREnclave;

	/**
	 * Constructor
	 */
	constructor() public RegistryEntry(msg.sender) {}

	function setup(
		string  calldata _appName,
		string  calldata _appType,
		bytes   calldata _appMultiaddr,
		bytes32          _appChecksum,
		bytes   calldata _appMREnclave)
	external onlyOnce()
	{
		m_appName      = _appName;
		m_appType      = _appType;
		m_appMultiaddr = _appMultiaddr;
		m_appChecksum  = _appChecksum;
		m_appMREnclave = _appMREnclave;
	}
}
