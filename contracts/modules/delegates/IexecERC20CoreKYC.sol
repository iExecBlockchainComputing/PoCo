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


contract IexecERC20CoreKYC is IexecERC20Core
{
	function _isAuthorized(address account)
	internal virtual override returns (bool)
	{
		return m_baseToken.isKYC(account);
	}

	function _beforeTokenTransfer(address from, address to, uint256 amount)
	internal virtual override
	{
		uint8 restrictionCode = m_baseToken.detectTransferRestriction(from, to, amount);
		if (restrictionCode != uint8(0))
		{
			revert(m_baseToken.messageForTransferRestriction(restrictionCode));
		}
	}
}
