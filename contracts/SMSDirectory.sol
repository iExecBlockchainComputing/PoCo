pragma solidity ^0.5.5;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

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
		require(_ressource == msg.sender || Ownable(_ressource).owner() == msg.sender);
		m_entries[_ressource] = _sms;
	}

}
