pragma solidity ^0.5.5;

import './App.sol';
import './RegistryBase.sol';

contract AppRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreateApp(address indexed appOwner, address app);

	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	/**
	 * App creation
	 */
	function createApp(
		address          _appOwner,
		string  calldata _appName,
		string  calldata _appType,
		bytes   calldata _appMultiaddr,
		bytes32          _appChecksum,
		bytes   calldata _appMREnclave)
	external /* onlyOwner /*owner == IexecHub*/ returns (App)
	{
		App newApp = new App(
			_appOwner,
			_appName,
			_appType,
			_appMultiaddr,
			_appChecksum,
			_appMREnclave
		);
		require(insert(address(newApp), _appOwner));
		emit CreateApp(_appOwner, address(newApp));
		return newApp;
	}

}
