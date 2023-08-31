// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2023 IEXEC BLOCKCHAIN TECH                                       *
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

pragma solidity ^0.8.0;

import "../DelegateBase.v8.sol";
import "../interfaces/IexecAccessorsBoost.sol";

/**
 * @title Access data related to Poco Boost deals.
 * @notice Access to PoCo Boost tasks must be done with classic `IexecAccessors`.
 */
contract IexecAccessorsBoostDelegate is IexecAccessorsBoost, DelegateBase {
    /**
     * Read deal Boost information.
     * @param id The ID of the deal.
     */
    function viewDealBoost(
        bytes32 id
    ) external view returns (IexecLibCore_v5.DealBoost memory deal) {
        return m_dealsBoost[id];
    }
}
