pragma solidity ^0.5.0;

import '../factory/CounterfactualFactory.sol';
import './Registry.sol';
import './App.sol';


contract AppRegistry is Registry, CounterfactualFactory
{
	event CreateApp(address indexed appOwner, address app);

	/**
	 * Constructor
	 */
	constructor(address _owner, address _previous)
	public Registry(_owner, "iExec Application Registry (v4)", "iExecAppsV4", _previous)
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
		App app = App(_create2(
			abi.encodePacked(
				type(App).creationCode,
				abi.encode(
					_appName,
					_appType,
					_appMultiaddr,
					_appChecksum,
					_appMREnclave
				)
			),
			bytes32(0)
		));

		_mint(_appOwner, uint256(address(app)));
		emit CreateApp(_appOwner, address(app));

		return app;
	}

}
