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
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;

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
        require(_requestorder.trust == 0, "PocoBoost: Non-zero trust level");
        require(
            _requestorder.category == _workerpoolorder.category,
            "PocoBoost: Category mismatch"
        );
        require(_requestorder.appmaxprice >= _apporder.appprice, "PocoBoost: Overpriced app");
        require(
            _requestorder.datasetmaxprice >= _datasetorder.datasetprice,
            "PocoBoost: Overpriced dataset"
        );
        require(
            _requestorder.workerpoolmaxprice >= _workerpoolorder.workerpoolprice,
            "PocoBoost: Overpriced workerpool"
        );

        bytes32 tag = _apporder.tag | _datasetorder.tag | _requestorder.tag;
        require(
            tag & ~_workerpoolorder.tag == 0x0,
            "PocoBoost: Workerpool tag does not match demand"
        );
        require(
            (tag ^ _apporder.tag)[31] & 0x01 == 0x0,
            "PocoBoost: App tag does not match demand"
        );

        // Check match
        require(_requestorder.app == _apporder.app, "PocoBoost: App mismatch");
        require(_requestorder.dataset == _datasetorder.dataset, "PocoBoost: Dataset mismatch");

        address appOwner = Ownable(_apporder.app).owner();
        bytes32 appOrderTypedDataHash = ECDSA.toTypedDataHash(
            EIP712DOMAIN_SEPARATOR,
            _apporder.hash()
        );
        require(
            _verifySignatureOrPresignature(appOwner, appOrderTypedDataHash, _apporder.sign),
            "PocoBoost: Invalid app order signature"
        );
        bool hasDataset = _requestorder.dataset != address(0);
        address datasetOwner;
        if (hasDataset) {
            datasetOwner = Ownable(_datasetorder.dataset).owner();
            bytes32 datasetOrderTypedDataHash = ECDSA.toTypedDataHash(
                EIP712DOMAIN_SEPARATOR,
                _datasetorder.hash()
            );
            require(
                _verifySignatureOrPresignature(
                    datasetOwner,
                    datasetOrderTypedDataHash,
                    _datasetorder.sign
                ),
                "PocoBoost: Invalid dataset order signature"
            );
        }
        bytes32 dealid = keccak256(abi.encodePacked(_requestorder.tag, _apporder.tag)); // random id
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealid];
        deal.requester = _requestorder.requester;
        deal.workerpoolOwner = Ownable(_workerpoolorder.workerpool).owner();
        deal.workerpoolPrice = uint96(_workerpoolorder.workerpoolprice);
        deal.appOwner = appOwner;
        deal.appPrice = uint96(_apporder.appprice); // TODO check overflow
        if (hasDataset) {
            deal.datasetOwner = datasetOwner;
            deal.datasetPrice = uint96(_datasetorder.datasetprice); // TODO check overflow
        }
        // deal.workerReward = ;
        deal.beneficiary = _requestorder.beneficiary;
        // deal.deadline = ;
        // deal.botFirst = ;
        // deal.botSize = ;
        deal.tag = tag;
        deal.callback = _requestorder.callback;
        // Notify workerpool.
        emit SchedulerNoticeBoost(
            _requestorder.workerpool,
            dealid,
            _requestorder.app,
            _requestorder.dataset,
            _requestorder.category,
            _requestorder.params
        );
        // Broadcast consumption of orders.
        emit OrdersMatchedBoost(dealid, appOrderTypedDataHash);
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
     * @param resultsCallback results of the task computed by the worker that will
     * be forwarded as call data to the callback address set by the requester.
     * @param authorizationSign authorization signed by the scheduler authorizing
     * the worker to push a result
     * @param enclaveChallenge enclave address which can produce enclave signature
     * @param enclaveSign signature generated from the enclave
     */
    function pushResultBoost(
        bytes32 dealId,
        uint index,
        bytes calldata results,
        bytes calldata resultsCallback,
        bytes calldata authorizationSign,
        address enclaveChallenge,
        bytes calldata enclaveSign
    ) external {
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealId];
        bytes32 taskId = keccak256(abi.encodePacked(dealId, index));
        // TODO: Check enclave challenge if TEE bit set
        // Check scheduler signature
        require(
            _verifySignatureOfEthSignedMessage(
                deal.workerpoolOwner,
                abi.encodePacked(msg.sender, taskId, enclaveChallenge),
                authorizationSign
            ),
            "PocoBoost: Invalid scheduler signature"
        );
        address target = deal.callback;
        bytes32 resultDigest = target == address(0)
            ? keccak256(abi.encodePacked(results))
            : keccak256(resultsCallback);
        // Check enclave signature
        require(
            enclaveChallenge == address(0) ||
                _verifySignatureOfEthSignedMessage(
                    enclaveChallenge,
                    abi.encodePacked(msg.sender, taskId, resultDigest),
                    enclaveSign
                ),
            "PocoBoost: Invalid enclave signature"
        );

        if (target != address(0)) {
            require(resultsCallback.length > 0, "PocoBoost: Callback requires data");
            (bool success, ) = target.call{gas: m_callbackgas}(
                abi.encodeWithSignature("receiveResult(bytes32,bytes)", taskId, resultsCallback)
            );
            success; // silent unused variable warning
            require(gasleft() > m_callbackgas / 63, "PocoBoost: Not enough gas after callback");
        }
        emit ResultPushedBoost(dealId, index, results);
    }

    /**
     * Verify that an Ethereum Signed Message is signed by a particular account.
     * @param account expected signer account
     * @param message original message that was signed
     * @param signature signature to be verified
     */
    function _verifySignatureOfEthSignedMessage(
        address account,
        bytes memory message,
        bytes calldata signature
    ) internal pure returns (bool) {
        return keccak256(message).toEthSignedMessageHash().recover(signature) == account;
    }

    /**
     * Verify that a message is signed by a particular account.
     * @param account expected signer account
     * @param messageHash message hash that was signed
     * @param signature signature to be verified
     */
    function _verifySignature(
        address account,
        bytes32 messageHash,
        bytes calldata signature
    ) internal pure returns (bool) {
        return messageHash.recover(signature) == account;
    }

    /**
     * Verify that a message hash is presigned by a particular account.
     * @param account expected presigner account
     * @param messageHash message hash that was presigned
     */
    function _verifyPresignature(
        address account,
        bytes32 messageHash
    ) internal view returns (bool) {
        return account != address(0) && account == m_presigned[messageHash];
    }

    /**
     * Verify that a message hash is signed or presigned by a particular account.
     * @param account expected signer or presigner account
     * @param messageHash message hash that was signed or presigned
     * @param signature signature to be verified. Not required for a presignature.
     */
    function _verifySignatureOrPresignature(
        address account,
        bytes32 messageHash,
        bytes calldata signature
    ) internal view returns (bool) {
        return
            (signature.length != 0 && _verifySignature(account, messageHash, signature)) ||
            _verifyPresignature(account, messageHash);
    }
}
