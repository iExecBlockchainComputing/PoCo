pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import '../libs/SafeMathOZ.sol';
import '../tools/Ownable.sol';

contract RegistryBase
{

	using SafeMathOZ for uint256;

	/**
	 * Members
	 */
	mapping(address => bool                       ) m_registered;
	mapping(address => mapping(uint256 => address)) m_byOwnerByIndex;
	mapping(address => uint256                    ) m_countByOwner;

	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	/**
	 * Accessors
	 */
	function isRegistered(address _entry)
	public view returns (bool)
	{
		return m_registered[_entry];
	}

	function viewEntry(address _owner, uint256 _index)
	public view returns (address)
	{
		return m_byOwnerByIndex[_owner][_index];
	}

	function viewCount(address _owner)
	public view returns (uint256)
	{
		return m_countByOwner[_owner];
	}

	/**
	 * Internal
	 */
	function insert(
		address _entry,
		address _owner)
	internal returns (bool)
	{
		uint id = m_countByOwner[_owner].add(1);
		m_countByOwner  [_owner]     = id;
		m_byOwnerByIndex[_owner][id] = _entry;
		m_registered    [_entry]     = true;
		return true;
	}
}
