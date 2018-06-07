pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./Pool.sol";
import "../tools/OwnableOZ.sol";
import "../tools/SafeMathOZ.sol";

contract PoolHub is OwnableOZ // is Owned by IexecHub
{

	using SafeMathOZ for uint256;

	/**
	 * Members
	 */
	mapping(address => uint256)                     m_poolCountByOwner;
	mapping(address => mapping(uint256 => address)) m_poolByOwnerByIndex;
	mapping(address => bool)                        m_poolRegistered;

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
	function isPoolRegistered(address _pool)
	public view returns (bool)
	{
		return m_poolRegistered[_pool];
	}

	function getPoolsCount(address _owner)
	public view returns (uint256)
	{
		return m_poolCountByOwner[_owner];
	}

	function getPool(address _owner, uint256 _index)
	public view returns (Pool)
	{
		return Pool(m_poolByOwnerByIndex[_owner][_index]);
	}

	/**
	 * Pool creation
	 */
	function createPool(
		address _poolOwner,
		string  _poolName,
		uint256 _subscriptionLockStakePolicy)
	public onlyOwner /*owner == IexecHub*/ returns (Pool)
	{
		Pool newPool = new Pool(_poolOwner, _poolName, _subscriptionLockStakePolicy);

		uint id = m_poolCountByOwner[_poolOwner].add(1);
		m_poolCountByOwner  [_poolOwner]     = id;
		m_poolByOwnerByIndex[_poolOwner][id] = newPool;
		m_poolRegistered    [newPool]        = true;

		return newPool;
	}
}
