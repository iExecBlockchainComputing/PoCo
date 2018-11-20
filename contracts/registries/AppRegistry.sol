pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import './App.sol';
import './RegistryBase.sol';

contract AppRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreateApp(
		address indexed appOwner,
		address         app,
		string          appName,
		string          appParams,
		bytes32         appHash);

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
		address _appOwner,
		string  _appName,
		string  _appParams,
		bytes32 _appHash)
	public /* onlyOwner /*owner == IexecHub*/ returns (App)
	{
		App newApp = new App(_appOwner, _appName, _appParams, _appHash);
		require(insert(newApp, _appOwner));
		emit CreateApp(_appOwner, newApp, _appName, _appParams, _appHash);
		return newApp;
	}

}
