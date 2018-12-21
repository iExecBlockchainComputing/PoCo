pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import '../tools/Ownable.sol';

contract App is OwnableImmutable
{
	/**
	 * Members
	 */
	string  public m_appName;
	bytes   public m_appMultiaddr;
	bytes   public m_appMREnclave;

	/**
	 * Constructor
	 */
	constructor(
		address        _appOwner,
		string  memory _appName,
		bytes   memory _appMultiaddr,
		bytes   memory _appMREnclave)
	public
	OwnableImmutable(_appOwner)
	{
		m_appName      = _appName;
		m_appMultiaddr = _appMultiaddr;
		m_appMREnclave = _appMREnclave;
	}

}
