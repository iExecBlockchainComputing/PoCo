pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../tools/ENSTools.sol";
import "../tools/Once.sol";

contract App is Ownable, Once, ENSTools
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
	function setup(
		address          _appOwner,
		string  calldata _appName,
		string  calldata _appType,
		bytes   calldata _appMultiaddr,
		bytes32          _appChecksum,
		bytes   calldata _appMREnclave)
	external onlyOnce()
	{
		_transferOwnership(_appOwner);
		m_appName      = _appName;
		m_appType      = _appType;
		m_appMultiaddr = _appMultiaddr;
		m_appChecksum  = _appChecksum;
		m_appMREnclave = _appMREnclave;
	}

	function registerENS(ENSRegistry ens, string calldata name)
	external onlyOwner()
	{
		_reverseRegistration(ens, name);
	}

	function transferOwnership(address) public { revert("disabled"); }

}
