pragma solidity ^0.5.0;

import "iexec-solidity/contracts/Libs/SafeMathExtended.sol";


contract RegistryBase
{

	using SafeMathExtended for uint256;

	/**
	 * Members
	 */
	mapping(address => bool                       ) internal m_registered;
	mapping(address => mapping(uint256 => address)) internal m_byOwnerByIndex;
	mapping(address => uint256                    ) internal m_countByOwner;

	address internal m_previous;

	/**
	 * Constructor
	 */
	constructor(address _previous)
	public
	{
		m_previous = _previous;
	}

	/**
	 * Accessors
	 */
	function isRegistered(address _entry)
	public view returns (bool)
	{
		return m_registered[_entry] || (m_previous != address(0) && RegistryBase(m_previous).isRegistered(_entry));
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

	function previous()
	public view returns (address)
	{
		return m_previous;
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
