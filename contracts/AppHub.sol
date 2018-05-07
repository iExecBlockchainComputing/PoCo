pragma solidity ^0.4.21;

import './App.sol';
import "./OwnableOZ.sol";
import "./SafeMathOZ.sol";

contract AppHub is OwnableOZ // is Owned by IexecHub
{

	using SafeMathOZ for uint256;

	/**
	 * Members
	 */
	mapping(address => uint256)                     m_appCountByOwner;
	mapping(address => mapping(uint256 => address)) m_appByOwnerByIndex;
	mapping(address => bool)                        m_appRegistered;

	mapping(uint256 => address)                     m_appByIndex;
	uint256 public                                  m_totalAppCount;

	/**
	 * Constructor
	 */
	function AppHub() public
	{
	}

	/**
	 * Methods
	 */
	function isAppRegistered(address _app) public view returns (bool)
	{
		return m_appRegistered[_app];
	}
	function getAppsCount(address _owner) public view returns (uint256)
	{
		return m_appCountByOwner[_owner];
	}
	function getApp(address _owner, uint256 _index) public view returns (address)
	{
		return m_appByOwnerByIndex[_owner][_index];
	}
	function getAppByIndex(uint256 _index) public view returns (address)
	{
		return m_appByIndex[_index];
	}

	function addApp(address _owner, address _app) internal
	{
		uint id = m_appCountByOwner[_owner].add(1);
		m_totalAppCount=m_totalAppCount.add(1);
		m_appByIndex       [m_totalAppCount] = _app;
		m_appCountByOwner  [_owner]          = id;
		m_appByOwnerByIndex[_owner][id]      = _app;
		m_appRegistered    [_app]            = true;
	}

	function createApp(
		string  _appName,
		uint256 _appPrice,
		string  _appParams)
	public onlyOwner /*owner == IexecHub*/ returns (address createdApp)
	{
		// tx.origin == owner
		// msg.sender == IexecHub
		address newApp = new App(
			msg.sender,
			_appName,
			_appPrice,
			_appParams
		);
		addApp(tx.origin, newApp);
		return newApp;
	}

}
