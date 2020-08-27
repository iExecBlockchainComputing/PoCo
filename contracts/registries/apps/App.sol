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

import "../RegistryEntry.sol";


contract App is RegistryEntry
{
	/**
	 * Members
	 */
	string  public  m_appName;
	string  public  m_appType;
	bytes   public  m_appMultiaddr;
	bytes32 public  m_appChecksum;
	bytes   public  m_appMREnclave;

	/**
	 * Constructor
	 */
	function initialize(
		string  memory _appName,
		string  memory _appType,
		bytes   memory _appMultiaddr,
		bytes32        _appChecksum,
		bytes   memory _appMREnclave)
	public
	{
		_initialize(msg.sender);
		m_appName      = _appName;
		m_appType      = _appType;
		m_appMultiaddr = _appMultiaddr;
		m_appChecksum  = _appChecksum;
		m_appMREnclave = _appMREnclave;
	}
}
