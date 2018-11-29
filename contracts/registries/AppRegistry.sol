pragma solidity ^0.5.0;
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
		address          _appOwner,
		string  calldata _appName,
		string  calldata _appParams,
		bytes32          _appHash)
	external /* onlyOwner /*owner == IexecHub*/ returns (App)
	{
		App newApp = new App(_appOwner, _appName, _appParams, _appHash);
		require(insert(address(newApp), _appOwner));
		emit CreateApp(_appOwner, address(newApp), _appName, _appParams, _appHash);
		return newApp;
	}

}
