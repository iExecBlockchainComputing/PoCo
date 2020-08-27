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
import "../interfaces/IexecCategoryManager.sol";


contract IexecCategoryManagerDelegate is IexecCategoryManager, DelegateBase
{
	/**
	 * Methods
	 */
	function createCategory(
		string  calldata name,
		string  calldata description,
		uint256          workClockTimeRef)
	external override onlyOwner returns (uint256)
	{
		m_categories.push(IexecLibCore_v5.Category(
			name,
			description,
			workClockTimeRef
		));

		uint256 catid = m_categories.length - 1;

		emit CreateCategory(
			catid,
			name,
			description,
			workClockTimeRef
		);
		return catid;
	}
}
