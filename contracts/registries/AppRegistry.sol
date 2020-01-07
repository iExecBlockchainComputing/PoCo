pragma solidity ^0.5.0;

import './Registry.sol';
import './App.sol';


contract AppRegistry is Registry
{
	/**
	 * Constructor
	 */
	constructor(address _previous)
	public Registry("iExec Application Registry (v4)", "iExecAppsV4", _previous)
	{
	}

	/**
	 * App creation
	 */
	function _creationCode()
	internal pure returns (bytes memory)
	{
		return type(App).creationCode;
	}

	function createApp(
		address          _appOwner,
		string  calldata _appName,
		string  calldata _appType,
		bytes   calldata _appMultiaddr,
		bytes32          _appChecksum,
		bytes   calldata _appMREnclave)
	external returns (App)
	{
		return App(_mintCreate(
			_appOwner,
			abi.encode(
				_appName,
				_appType,
				_appMultiaddr,
				_appChecksum,
				_appMREnclave
			)
		));
	}

}
