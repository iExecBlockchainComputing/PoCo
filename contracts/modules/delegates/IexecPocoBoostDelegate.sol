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
    /// @param _apporder The order signed by the application developer
    /// @param _datasetorder The order signed by the dataset provider
    /// @param _workerpoolorder The order signed by the workerpool manager
    /// @param _requestorder The order signed by the requester
    function matchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata _apporder,
        IexecLibOrders_v5.DatasetOrder calldata _datasetorder,
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
        deal.requester = _requestorder.requester;
        deal.workerpoolOwner = Ownable(_workerpoolorder.workerpool).owner();
        deal.workerpoolPrice = uint96(_workerpoolorder.workerpoolprice);
        deal.appOwner = Ownable(_apporder.app).owner();
        deal.appPrice = uint96(_apporder.appprice); // TODO check overflow
        bool hasDataset = true; // TODO
        // deal.datasetOwner = ;
        deal.datasetPrice = uint96(hasDataset ? _datasetorder.datasetprice : 0); // TODO check overflow
        // deal.workerReward = ;
        deal.beneficiary = _requestorder.beneficiary;
        // deal.deadline = ;
        // deal.botFirst = ;
        // deal.botSize = ;
        // deal.tag = ;
        deal.callback = _requestorder.callback;
        // TODO emit deal params
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
     * @notice Accept results of a task computed by a worker during Boost workflow.
     * @param dealId id of the target deal
     * @param index index of the target task of the deal
     * @param results results of the task computed by the worker
     * @param authorizationSign authorization signed by the scheduler authorizing
     * the worker to push a result
     * @param enclaveChallenge enclave address which can produce enclave signature
     * @param enclaveSign signature generated from the enclave
     */
    function pushResultBoost(
        bytes32 dealId,
        uint index,
        bytes calldata results,
        bytes calldata authorizationSign,
        address enclaveChallenge,
        bytes calldata enclaveSign
    ) external {
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealId];
        bytes32 taskId = keccak256(abi.encodePacked(dealId, index));
        // TODO: Check enclave challenge if TEE bit set
        // Check scheduler signature
        require(
            _verifySignature(
                deal.workerpoolOwner,
                abi.encodePacked(msg.sender, taskId, enclaveChallenge),
                authorizationSign
            ),
            "PocoBoost:  Invalid scheduler signature"
        );
        bytes32 resultDigest = keccak256(abi.encodePacked(results));
        // Check enclave signature
        require(
            enclaveChallenge == address(0) ||
                _verifySignature(
                    enclaveChallenge,
                    abi.encodePacked(msg.sender, taskId, resultDigest),
                    enclaveSign
                ),
            "PocoBoost: Invalid enclave signature"
        );
        emit ResultPushedBoost(dealId, index, results);
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
