pragma solidity ^0.5.5;

import "../../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract App is Ownable
{
	/**
	 * Members
	 */
	string  public m_appName;
	string  public m_appType;
	bytes   public m_appMultiaddr;
	bytes32 public m_appChecksum;
	bytes   public m_appMREnclave;

	/**
	 * Constructor
	 */
	constructor(
		address        _appOwner,
		string  memory _appName,
		string  memory _appType,
		bytes   memory _appMultiaddr,
		bytes32        _appChecksum,
		bytes   memory _appMREnclave)
	public
	{
		_transferOwnership(_appOwner);
		m_appName      = _appName;
		m_appType      = _appType;
		m_appMultiaddr = _appMultiaddr;
		m_appChecksum  = _appChecksum;
		m_appMREnclave = _appMREnclave;
	}

	function transferOwnership(address) public { revert("disabled"); }

}
