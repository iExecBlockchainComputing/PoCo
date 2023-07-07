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
import "@openzeppelin/contracts-v4/utils/cryptography/ECDSA.sol";

import "../DelegateBase.v8.sol";
import "../interfaces/IexecPocoBoost.sol";
import "../interfaces/IexecAccessorsBoost.sol";

/// @title PoCo Boost to reduce latency and increase throughput of deals.
/// @notice Works for deals with requested trust = 0.
contract IexecPocoBoostDelegate is IexecPocoBoost, IexecAccessorsBoost, DelegateBase {
    using ECDSA for bytes32;

    /// @notice This boost match orders is only compatible with trust = 0.
    /// @param _requestorder The order signed by the requester
    /// @param _apporder The order signed by the application developer
    function matchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata _apporder,
        IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder,
        IexecLibOrders_v5.RequestOrder calldata _requestorder
    ) external {
        require(_requestorder.trust == 0, "MatchOrdersBoost: Trust level is not zero");
        require(
            _requestorder.category == _workerpoolorder.category,
            "MatchOrdersBoost: Category mismatch"
        );

        bytes32 dealid = keccak256(abi.encodePacked(_requestorder.tag, _apporder.tag)); // random id
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealid];
        deal.appOwner = Ownable(_apporder.app).owner();
        deal.workerpoolOwner = Ownable(_workerpoolorder.workerpool).owner();
        deal.tag = _requestorder.tag; // set random field
        emit OrdersMatchedBoost(dealid);
    }

    // TODO: Move to IexecAccessorsBoost
    function viewDealBoost(
        bytes32 _id
    ) external view returns (IexecLibCore_v5.DealBoost memory deal) {
        return m_dealsBoost[_id];
    }

    /**
     * @notice Accept a result for a task computed by a worker during Boost workflow.
     * @param _dealId id of the target deal
     * @param _index index of the target task of the deal
     * @param _authorizationSign authorization signed by the scheduler authorizing
     * the worker to push a result
     * @param _enclaveChallenge enclave address which can produce enclave signature
     */
    function pushResultBoost(
        bytes32 _dealId,
        uint _index,
        bytes32 _result,
        bytes calldata _authorizationSign,
        address _enclaveChallenge
    ) external {
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[_dealId];
        bytes32 taskId = keccak256(abi.encodePacked(_dealId, _index));
        // Check scheduler signature
        require(
            _verifySignature(
                deal.workerpoolOwner,
                abi.encodePacked(msg.sender, taskId, _enclaveChallenge),
                _authorizationSign
            ),
            "PushResultBoost: Scheduler signature is not valid"
        );
        emit ResultPushedBoost(_dealId, _index, _result);
    }

    /**
     * Verify that a message a signed by a particular account.
     * @param account expected signer account
     * @param message original message that was signed
     * @param signature signature to be verified
     */
    function _verifySignature(
        address account,
        bytes memory message,
        bytes memory signature
    ) internal pure returns (bool) {
        return keccak256(message).toEthSignedMessageHash().recover(signature) == account;
    }
}
