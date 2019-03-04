pragma solidity ^0.5.3;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract PubKeyDirectory
{
	mapping(address => bytes) m_pubkeys;

	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	function getKey(address _addr)
	external view returns (bytes memory)
	{
		return m_pubkeys[_addr];
	}

	function setKey(bytes calldata _key)
	external
	{
		// Extract address from public key
		require(_key.length == 0x40);
		bytes20 addr = bytes20(keccak256(_key) << 0x60);
		// Store public key
		m_pubkeys[address(addr)] = _key;
	}

	function setContractKey(address _contract, bytes calldata _key)
	external
	{
		// Check _contract is in fact a contract
		uint size;
		assembly { size := extcodesize(_contract) }
		require(size > 0);
		// Check operation is performed by the owner
		require(_contract == msg.sender || Ownable(_contract).owner() == msg.sender);
		// Store public key
		m_pubkeys[_contract] = _key;
	}

}
