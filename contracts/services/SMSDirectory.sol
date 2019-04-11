pragma solidity ^0.5.7;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../SignatureVerifier.sol";

contract SMSDirectory is SignatureVerifier
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

	function setSMS(address _ressource, bytes calldata _data)
	external
	{
		require(checkIdentity(_ressource, msg.sender, 0x2));
		m_entries[_ressource] = _data;
	}

	function setSMS_owned(address _ressource, bytes calldata _data)
	external
	{
		require(checkIdentity(Ownable(_ressource).owner(), msg.sender, 0x2));
		m_entries[_ressource] = _data;
	}

}
