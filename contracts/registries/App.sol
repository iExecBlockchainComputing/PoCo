pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import '../tools/Ownable.sol';

contract App is OwnableImmutable
{
	/**
	 * Members
	 */
	string  public m_appName;
	string  public m_appParams;
	bytes32 public m_appHash;

	/**
	 * Constructor
	 */
	constructor(
		address _appOwner,
		string  _appName,
		string  _appParams,
		bytes32 _appHash)
	public
	OwnableImmutable(_appOwner)
	{
		m_appName   = _appName;
		m_appParams = _appParams;
		m_appHash   = _appHash;
	}

}
