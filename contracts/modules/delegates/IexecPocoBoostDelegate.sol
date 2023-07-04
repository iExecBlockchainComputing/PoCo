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

import "@openzeppelin/contracts-v4/access/Ownable.sol";

import "../DelegateBase.v8.sol";
import "../interfaces/IexecPocoBoost.sol";
import "../interfaces/IexecAccessorsBoost.sol";

/// @title PoCo Boost to reduce latency and increase throughput of deals.
/// @notice Works for deals with requested trust = 0.
contract IexecPocoBoostDelegate is IexecPocoBoost, IexecAccessorsBoost, DelegateBase {
    /// @notice This boost match orders is only compatible with trust = 0.
    /// @param _requestorder The order signed by the requester
    /// @param _apporder The order signed by the application developer
    function matchOrdersBoost(
        IexecLibOrders_v5.RequestOrder memory _requestorder,
        IexecLibOrders_v5.AppOrder memory _apporder
    ) public {
        require(_requestorder.tag == _apporder.tag, "Incompatible request and app orders");
        bytes32 dealid = keccak256(abi.encodePacked(_requestorder.tag, _apporder.tag)); // random id
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealid];
        deal.appOwner = Ownable(_apporder.app).owner();
        deal.tag = _requestorder.tag; // set random field
        emit OrdersMatchedBoost(dealid);
    }

    // TODO: Move to IexecAccessorsBoost
    function viewDealBoost(bytes32 _id) external view returns (IexecLibCore_v5.DealBoost memory deal) {
        return m_dealsBoost[_id];
    }

    /// @notice Accept a result for a task computed by a worker during Boost workflow.
    /// @param _dealId id of the target deal.
    /// @param _index index of the target task of the deal.
    /// @param _result result bytes.
    function pushResultBoost(bytes32 _dealId, uint _index, bytes32 _result) public {
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[_dealId];
        require(deal.appOwner != address(0), "Deal not found");
        emit ResultPushedBoost(_dealId, _index, _result);
    }
}
