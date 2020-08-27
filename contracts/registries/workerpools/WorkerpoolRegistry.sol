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
import './Workerpool.sol';


contract WorkerpoolRegistry is Registry
{
	/**
	 * Constructor
	 */
	constructor()
	public Registry(
		address(new Workerpool()),
		'iExec Workerpool Registry (V5)',
		'iExecWorkerpoolV5')
	{
	}

	/**
	 * Pool creation
	 */
	function encodeInitializer(
		string memory _workerpoolDescription)
	internal pure returns (bytes memory)
	{
		return abi.encodeWithSignature(
			'initialize(string)'
		,	_workerpoolDescription
		);
	}

	function createWorkerpool(
		address          _workerpoolOwner,
		string  calldata _workerpoolDescription)
	external returns (Workerpool)
	{
		return Workerpool(_mintCreate(_workerpoolOwner, encodeInitializer(_workerpoolDescription)));
	}

	function predictWorkerpool(
		address          _workerpoolOwner,
		string  calldata _workerpoolDescription)
	external view returns (Workerpool)
	{
		return Workerpool(_mintPredict(_workerpoolOwner, encodeInitializer(_workerpoolDescription)));
	}
}
