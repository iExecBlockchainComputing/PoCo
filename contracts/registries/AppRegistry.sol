pragma solidity ^0.5.0;

import './App.sol';
import './CounterfactualFactory.sol';
import './RegistryBase.sol';


contract AppRegistry is CounterfactualFactory, RegistryBase, ENSReverseRegistrationOwnable
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
	external returns (App)
	{
		bytes32 salt = keccak256(abi.encodePacked(
			_appName,
			_appType,
			_appMultiaddr,
			_appChecksum,
			_appMREnclave
		));

		App app = App(_create2(type(App).creationCode, salt));
		app.setup(
			_appOwner,
			_appName,
			_appType,
			_appMultiaddr,
			_appChecksum,
			_appMREnclave
		);

		insert(address(app), _appOwner);
		emit CreateApp(_appOwner, address(app));

		return app;
	}

}
