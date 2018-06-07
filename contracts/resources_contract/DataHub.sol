pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./Data.sol";
import "../tools/Ownable.sol";
import "../tools/SafeMathOZ.sol";

contract DataHub is OwnableMutable // is Owned by IexecHub
{

	using SafeMathOZ for uint256;

	/**
	 * Members
	 */
	mapping(address => uint256)                     m_dataCountByOwner;
	mapping(address => mapping(uint256 => address)) m_dataByOwnerByIndex;
	mapping(address => bool)                        m_dataRegistered;

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
	function isDataRegistered(address _data)
	public view returns (bool)
	{
		return m_dataRegistered[_data];
	}

	function getDatasCount(address _owner)
	public view returns (uint256)
	{
		return m_dataCountByOwner[_owner];
	}

	function getData(address _owner, uint256 _index)
	public view returns (Data)
	{
		return Data(m_dataByOwnerByIndex[_owner][_index]);
	}

	/**
	 * Data creation
	 */
	function createData(
		address _dataOwner,
		string  _dataName,
		string  _dataParams)
	public onlyOwner /*owner == IexecHub*/ returns (Data)
	{
		Data newData = new Data(_dataOwner, _dataName, _dataParams);

		uint id = m_dataCountByOwner[_dataOwner].add(1);
		m_dataCountByOwner  [_dataOwner]     = id;
		m_dataByOwnerByIndex[_dataOwner][id] = newData;
		m_dataRegistered    [newData]        = true;

		return newData;
	}
}
