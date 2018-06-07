pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import '../tools/OwnableOZ.sol';

contract Dapp is OwnableOZ //, IexecHubAccessor
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
	{
		transferOwnership(_dappOwner);
		m_dappName   = _dappName;
		m_dappParams = _dappParams;
	}

}
