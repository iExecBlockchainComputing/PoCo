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

import "./IexecERC20Core.sol";
import "../DelegateBase.sol";
import "../interfaces/IexecERC20.sol";
import "../interfaces/IexecTokenSpender.sol";


contract IexecERC20Delegate is IexecERC20, DelegateBase, IexecERC20Core
{
	function transfer(address recipient, uint256 amount)
	external override returns (bool)
	{
		_transfer(_msgSender(), recipient, amount);
		return true;
	}

	function approve(address spender, uint256 value)
	external override returns (bool)
	{
		_approve(_msgSender(), spender, value);
		return true;
	}

	function approveAndCall(address spender, uint256 value, bytes calldata extraData)
	external override returns (bool)
	{
		_approve(_msgSender(), spender, value);
		require(IexecTokenSpender(spender).receiveApproval(_msgSender(), value, address(this), extraData), 'approval-refused');
		return true;
	}

	function transferFrom(address sender, address recipient, uint256 amount)
	external override returns (bool)
	{
		_transfer(sender, recipient, amount);
		_approve(sender, _msgSender(), m_allowances[sender][_msgSender()].sub(amount));
		return true;
	}

	function increaseAllowance(address spender, uint256 addedValue)
	external override returns (bool)
	{
		_approve(_msgSender(), spender, m_allowances[_msgSender()][spender].add(addedValue));
		return true;
	}


	function decreaseAllowance(address spender, uint256 subtractedValue)
	external override returns (bool)
	{
			_approve(_msgSender(), spender, m_allowances[_msgSender()][spender].sub(subtractedValue));
			return true;
	}
}
