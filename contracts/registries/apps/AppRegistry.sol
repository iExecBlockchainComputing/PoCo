// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

pragma solidity ^0.6.0;

import '../Registry.sol';
import './App.sol';


contract AppRegistry is Registry
{
	/**
	 * Constructor
	 */
	constructor()
	public Registry(
		address(new App()),
		'iExec Application Registry (V5)',
		'iExecAppsV5')
	{
	}

	/**
	 * App creation
	 */
	function encodeInitializer(
		string  memory _appName,
		string  memory _appType,
		bytes   memory _appMultiaddr,
		bytes32        _appChecksum,
		bytes   memory _appMREnclave)
	internal pure returns (bytes memory)
	{
		return abi.encodeWithSignature(
			'initialize(string,string,bytes,bytes32,bytes)'
		,	_appName
		,	_appType
		,	_appMultiaddr
		,	_appChecksum
		,	_appMREnclave
		);
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
		return App(_mintCreate(_appOwner, encodeInitializer(_appName, _appType, _appMultiaddr, _appChecksum, _appMREnclave)));
	}

	function predictApp(
		address          _appOwner,
		string  calldata _appName,
		string  calldata _appType,
		bytes   calldata _appMultiaddr,
		bytes32          _appChecksum,
		bytes   calldata _appMREnclave)
	external view returns (App)
	{
		return App(_mintPredict(_appOwner, encodeInitializer(_appName, _appType, _appMultiaddr, _appChecksum, _appMREnclave)));
	}
}
