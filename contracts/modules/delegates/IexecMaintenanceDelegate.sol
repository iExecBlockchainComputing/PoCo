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
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/IexecMaintenance.sol";


contract IexecMaintenanceDelegate is IexecMaintenance, DelegateBase
{
	using SafeMathExtended  for uint256;
	using IexecLibOrders_v5 for IexecLibOrders_v5.EIP712Domain;

	function configure(
		address          _token,
		string  calldata _name,
		string  calldata _symbol,
		uint8            _decimal,
		address          _appregistryAddress,
		address          _datasetregistryAddress,
		address          _workerpoolregistryAddress,
		address          _v3_iexecHubAddress)
	external override onlyOwner()
	{
		require(EIP712DOMAIN_SEPARATOR == bytes32(0), 'already-configured');
		EIP712DOMAIN_SEPARATOR = _domain().hash();

		m_baseToken          = IERC20(_token);
		m_name               = _name;
		m_symbol             = _symbol;
		m_decimals           = _decimal;
		m_appregistry        = IRegistry(_appregistryAddress);
		m_datasetregistry    = IRegistry(_datasetregistryAddress);
		m_workerpoolregistry = IRegistry(_workerpoolregistryAddress);
		m_v3_iexecHub        = IexecHubInterface(_v3_iexecHubAddress);
		m_callbackgas        = 100000;
	}

	function domain()
	external view override returns (IexecLibOrders_v5.EIP712Domain memory)
	{
		return _domain();
	}

	function updateDomainSeparator()
	external override
	{
		require(EIP712DOMAIN_SEPARATOR != bytes32(0), 'not-configured');
		EIP712DOMAIN_SEPARATOR = _domain().hash();
	}

	function importScore(address _worker)
	external override
	{
		require(!m_v3_scoreImported[_worker], 'score-already-imported');
		m_workerScores[_worker] = m_workerScores[_worker].max(m_v3_iexecHub.viewScore(_worker));
		m_v3_scoreImported[_worker] = true;
	}

	function setTeeBroker(address _teebroker)
	external override onlyOwner()
	{
		m_teebroker = _teebroker;
	}

	function setCallbackGas(uint256 _callbackgas)
	external override onlyOwner()
	{
		m_callbackgas = _callbackgas;
	}

	function _chainId()
	internal pure returns (uint256 id)
	{
		assembly { id := chainid() }
	}

	function _domain()
	internal view returns (IexecLibOrders_v5.EIP712Domain memory)
	{
		return IexecLibOrders_v5.EIP712Domain({
			name:              'iExecODB'
		,	version:           '5.0.0'
		,	chainId:           _chainId()
		,	verifyingContract: address(this)
		});
	}
}
