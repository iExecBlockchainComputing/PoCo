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
import "../interfaces/IexecEscrowToken.sol";
import "../interfaces/IexecTokenSpender.sol";


contract IexecEscrowTokenDelegate is IexecEscrowToken, IexecTokenSpender, DelegateBase, IexecERC20Core
{
	using SafeMathExtended for uint256;

	/***************************************************************************
	 *                         Escrow methods: public                          *
	 ***************************************************************************/
	receive()
	external override payable
	{
		revert('fallback-disabled');
	}

	fallback()
	external override payable
	{
		revert('fallback-disabled');
	}

	function deposit(uint256 amount)
	external override returns (bool)
	{
		_deposit(_msgSender(), amount);
		_mint(_msgSender(), amount);
		return true;
	}

	function depositFor(uint256 amount, address target)
	external override returns (bool)
	{
		_deposit(_msgSender(), amount);
		_mint(target, amount);
		return true;
	}

	function depositForArray(uint256[] calldata amounts, address[] calldata targets)
	external override returns (bool)
	{
		require(amounts.length == targets.length, 'invalid-array-length');
		for (uint i = 0; i < amounts.length; ++i)
		{
			_deposit(_msgSender(), amounts[i]);
			_mint(targets[i], amounts[i]);
		}
		return true;
	}

	function withdraw(uint256 amount)
	external override returns (bool)
	{
		_burn(_msgSender(), amount);
		_withdraw(_msgSender(), amount);
		return true;
	}

	function withdrawTo(uint256 amount, address target)
	external override returns (bool)
	{
		_burn(_msgSender(), amount);
		_withdraw(target, amount);
		return true;
	}

	function recover()
	external override onlyOwner returns (uint256)
	{
		uint256 delta = m_baseToken.balanceOf(address(this)).sub(m_totalSupply);
		_mint(owner(), delta);
		return delta;
	}

	// Token Spender (endpoint for approveAndCallback calls to the proxy)
	function receiveApproval(address sender, uint256 amount, address token, bytes calldata)
	external override returns (bool)
	{
		require(token == address(m_baseToken), 'wrong-token');
		_deposit(sender, amount);
		_mint(sender, amount);
		return true;
	}

	function _deposit(address from, uint256 amount)
	internal
	{
		require(m_baseToken.transferFrom(from, address(this), amount), 'failled-transferFrom');
	}

	function _withdraw(address to, uint256 amount)
	internal
	{
		m_baseToken.transfer(to, amount);
	}
}
