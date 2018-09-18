pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import '../tools/Ownable.sol';

contract Dapp is OwnableImmutable
{

	/**
	 * Members
	 */
	string  public m_dappName;
	string  public m_dappParams;
	bytes32 public m_dappHash;

	/**
	 * Constructor
	 */
	constructor(
		address _dappOwner,
		string  _dappName,
		string  _dappParams,
		bytes32 _dappHash)
	public
	OwnableImmutable(_dappOwner)
	{
		m_dappName   = _dappName;
		m_dappParams = _dappParams;
		m_dappHash   = _dappHash;
	}

}
