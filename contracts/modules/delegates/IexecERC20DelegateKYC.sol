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

import "./IexecERC20Delegate.sol";
import "./IexecERC20CoreKYC.sol";


contract IexecERC20DelegateKYC is IexecERC20Delegate, IexecERC20CoreKYC
{
	function _beforeTokenTransfer(address from, address to, uint256 amount)
	internal virtual override(IexecERC20Core, IexecERC20CoreKYC)
	{
		IexecERC20CoreKYC._beforeTokenTransfer(from, to, amount);
	}

	function _isAuthorized(address account)
	internal virtual override(IexecERC20Core, IexecERC20CoreKYC) returns (bool)
	{
		return IexecERC20CoreKYC._isAuthorized(account);
	}
}
