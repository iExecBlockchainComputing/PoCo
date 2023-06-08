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
import "../../libs/IexecLibCore_v5.sol";

/// @title PoCo Boost to reduce latency and increase throughput of deals.
/// @notice Works for deals with requested trust = 0.
contract IexecPocoBoostDelegate is DelegateBase {
    event OrdersMatchedBoost(bytes32 dealid);

    /// @notice This boost match orders is only compatible with trust = 0.
    /// @param _requestorder The order signed by the requester
    /// @param _apporder The order signed by the application developer
    function matchOrdersBoost(uint _requestorder, uint _apporder) public {
        require(
            _requestorder == _apporder,
            "Incompatible request and app orders"
        );
        bytes32 dealid = keccak256(abi.encodePacked(_requestorder, _apporder)); // random id
        IexecLibCore_v5.Deal storage deal = m_deals[dealid];
        deal.tag = keccak256(abi.encodePacked(_requestorder)); // set random field
        emit OrdersMatchedBoost(dealid);
    }

    // TODO: Move to IexecAccessorsBoost
    function viewDealBoost(
        bytes32 _id
    ) external view returns (IexecLibCore_v5.Deal memory deal) {
        return m_deals[_id];
    }
}
