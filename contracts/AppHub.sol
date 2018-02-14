pragma solidity ^0.4.18;

import './App.sol';
import "./OwnableOZ.sol";
import "./SafeMathOZ.sol";

contract AppHub is OwnableOZ // is Owned by IexecHub
{

	using SafeMathOZ for uint256;

	/**
	 * Members
	 */
	// owner => apps count
	//  app => owner
	mapping(address => address[]) m_appByOwnerByIndex;
	mapping(address => address)   m_ownerByApp;

	/**
	 * Constructor
	 */
	function AppHub() public
	{
	}

	/**
	 * Methods
	 */
	function getAppsCount(address _owner) public view returns (uint256)
	{
		return m_appByOwnerByIndex[_owner].length;
	}

	function getApp(address _owner, uint256 _index) public view returns (address)
	{
		return m_appByOwnerByIndex[_owner][_index];
	}

	function getAppOwner(address _app) public view returns (address)
	{
		return m_ownerByApp[_app];
	}

	function isAppRegistred(address _app) public view returns (bool)
	{
		return m_ownerByApp[_app] != address(0);
	}

	function createApp(
		string  _appName,
		uint256 _appPrice,
		string  _appParams)
	public onlyOwner /*owner == IexecHub*/ returns (address createdApp)
	{
		// tx.origin == owner
		// msg.sender == IexecHub
		address newApp = new App(msg.sender, _appName, _appPrice, _appParams);

		m_appByOwnerByIndex[tx.origin].push(newApp); // returns index of newApp
		m_ownerByApp[newApp] = tx.origin;
		return newApp;
	}

	function getAppPrice(address _app) public view returns (uint256 appPrice)
	{
		return App(_app).m_appPrice();
	}

	function isOpen(address _app) public view returns (bool)
	{
		return App(_app).isOpen();
	}

	function isWorkerPoolAllowed(address _app, address _workerPool) public returns (bool)
	{
		return App(_app).isWorkerPoolAllowed(_workerPool);
	}

	function isDatasetAllowed(address _app, address _dataset) public returns (bool)
	{
		return App(_app).isDatasetAllowed(_dataset);
	}

	function isRequesterAllowed(address _app, address _requester) public returns (bool)
	{
		return App(_app).isRequesterAllowed(_requester);
	}



}
