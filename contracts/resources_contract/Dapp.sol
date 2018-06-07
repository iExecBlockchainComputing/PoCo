pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import '../tools/Ownable.sol';

contract Dapp is OwnableImmutable
{

	/**
	 * Members
	 */
	string public m_dappName;
	string public m_dappParams;

	/**
	 * Constructor
	 */
	constructor(
		address _dappOwner,
		string  _dappName,
		string  _dappParams)
	public
	OwnableImmutable(_dappOwner)
	{
		m_dappName   = _dappName;
		m_dappParams = _dappParams;
	}

}
