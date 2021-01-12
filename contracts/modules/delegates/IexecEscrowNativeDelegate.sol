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
import "../interfaces/IexecEscrowNative.sol";


contract IexecEscrowNativeDelegate is IexecEscrowNative, DelegateBase, IexecERC20Core
{
	using SafeMathExtended for uint256;

	uint256 internal constant nRLCtoWei = 10 ** 9;
	/***************************************************************************
	 *                         Escrow methods: public                          *
	 ***************************************************************************/
	receive()
	external override payable
	{
		_deposit(_msgSender());
	}

	fallback()
	external override payable
	{
		_deposit(_msgSender());
	}

	function deposit()
	external override payable returns (bool)
	{
		_deposit(_msgSender());
		return true;
	}

	function depositFor(address target)
	external override payable returns (bool)
	{
		_deposit(target);
		return true;
	}

	function depositForArray(uint256[] calldata amounts, address[] calldata targets)
	external override payable returns (bool)
	{
		require(amounts.length == targets.length, 'invalid-array-length');
		uint256 remaining = msg.value;
		for (uint i = 0; i < amounts.length; ++i)
		{
			_mint(targets[i], amounts[i]);
			remaining = remaining.sub(amounts[i].mul(nRLCtoWei));
		}
		_withdraw(_msgSender(), remaining);
		return true;
	}

	function withdraw(uint256 amount)
	external override returns (bool)
	{
		_burn(_msgSender(), amount);
		_withdraw(_msgSender(), amount.mul(nRLCtoWei));
		return true;
	}

	function withdrawTo(uint256 amount, address target)
	external override returns (bool)
	{
		_burn(_msgSender(), amount);
		_withdraw(target, amount.mul(nRLCtoWei));
		return true;
	}

	function recover()
	external override onlyOwner returns (uint256)
	{
		uint256 delta = address(this).balance.div(nRLCtoWei).sub(m_totalSupply);
		_mint(owner(), delta);
		return delta;
	}

	function _deposit(address target)
	internal
	{
		_mint(target, msg.value.div(nRLCtoWei));
		_withdraw(_msgSender(), msg.value.mod(nRLCtoWei));
	}

	function _withdraw(address to, uint256 value)
	internal
	{
		(bool success, ) = to.call{value: value}('');
		require(success, 'native-transfer-failed');
	}
}
