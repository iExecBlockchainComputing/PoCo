pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;

import './tools/Ownable.sol';

contract SMSDirectory
{
	mapping(address => bytes) m_entries;

	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	function getSMS(address _ressource)
	external view returns (bytes memory)
	{
		return m_entries[_ressource];
	}

	function setSMS(address _ressource, bytes calldata _sms)
	external
	{
		require(_ressource == msg.sender || OwnableImmutable(_ressource).m_owner() == msg.sender);
		m_entries[_ressource] = _sms;
	}

}
