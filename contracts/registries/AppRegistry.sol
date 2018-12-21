pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

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
		bytes   calldata _appMultiaddr,
		bytes   calldata _appMREnclave)
	external /* onlyOwner /*owner == IexecHub*/ returns (App)
	{
		App newApp = new App(_appOwner, _appName, _appMultiaddr, _appMREnclave);
		require(insert(address(newApp), _appOwner));
		emit CreateApp(_appOwner, address(newApp));
		return newApp;
	}

}
