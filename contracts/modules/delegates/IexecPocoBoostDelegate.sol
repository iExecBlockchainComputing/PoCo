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

import "@openzeppelin/contracts-v4/interfaces/IERC5313.sol";
import "@openzeppelin/contracts-v4/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-v4/utils/math/Math.sol";
import "@openzeppelin/contracts-v4/utils/math/SafeCast.sol";

import "../../registries/workerpools/IWorkerpool.v8.sol";
import "./IexecEscrow.v8.sol";
import "../DelegateBase.v8.sol";
import "../interfaces/IexecPocoBoost.sol";
import "../interfaces/IexecAccessorsBoost.sol";

/// @title PoCo Boost to reduce latency and increase throughput of deals.
/// @notice Works for deals with requested trust = 0.
contract IexecPocoBoostDelegate is IexecPocoBoost, IexecAccessorsBoost, DelegateBase, IexecEscrow {
    using ECDSA for bytes32;
    using Math for uint256;
    using SafeCast for uint256;
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

    /**
     * @notice This boost match orders is only compatible with trust = 0.
     * @param _apporder The order signed by the application developer
     * @param _datasetorder The order signed by the dataset provider
     * @param _workerpoolorder The order signed by the workerpool manager
     * @param _requestorder The order signed by the requester
     *
     * @dev Considering min·max·avg gas values, preferred option for deal storage
     *  is b.:
     *   - a. 213498·273978·240761: Use memory struct and write new struct to storage once
     *   - b. 213803·274283·240615: Use memory struct and write to storage field per field
     *   - c. 213990·274470·240732: Write/read everything to/on storage
     *   - d. 215729·276197·242985: Write/read everything to/on memory struct and asign memory to storage
     */
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
        require(_requestorder.category < m_categories.length, "PocoBoost: Unknown category");
        require(_requestorder.appmaxprice >= _apporder.appprice, "PocoBoost: Overpriced app");
        require(
            _requestorder.datasetmaxprice >= _datasetorder.datasetprice,
            "PocoBoost: Overpriced dataset"
        );
        require(
            _requestorder.workerpoolmaxprice >= _workerpoolorder.workerpoolprice,
            "PocoBoost: Overpriced workerpool"
        );
        // Save some local variables in memory with a structure to fix `Stack too deep`.
        IexecLibCore_v5.DealBoost memory vars;
        bytes32 tag = _apporder.tag | _datasetorder.tag | _requestorder.tag;
        require(
            tag & ~_workerpoolorder.tag == 0x0,
            "PocoBoost: Workerpool tag does not match demand"
        );
        require(
            (tag ^ _apporder.tag)[31] & 0x01 == 0x0,
            "PocoBoost: App tag does not match demand"
        );

        // Check match and restriction
        require(_requestorder.app == _apporder.app, "PocoBoost: App mismatch");
        require(_requestorder.dataset == _datasetorder.dataset, "PocoBoost: Dataset mismatch");
        require(
            _isNullIdentityOrEquals(_requestorder.workerpool, _workerpoolorder.workerpool),
            "PocoBoost: Workerpool restricted by request order"
        );
        require(
            _isNullIdentityOrEquals(_apporder.datasetrestrict, _datasetorder.dataset),
            "PocoBoost: Dataset restricted by app order"
        );
        require(
            _isNullIdentityOrEquals(_apporder.workerpoolrestrict, _workerpoolorder.workerpool),
            "PocoBoost: Workerpool restricted by app order"
        );
        require(
            _isNullIdentityOrEquals(_apporder.requesterrestrict, _requestorder.requester),
            "PocoBoost: Requester restricted by app order"
        );
        require(
            _isNullIdentityOrEquals(_datasetorder.apprestrict, _apporder.app),
            "PocoBoost: App restricted by dataset order"
        );
        require(
            _isNullIdentityOrEquals(_datasetorder.workerpoolrestrict, _workerpoolorder.workerpool),
            "PocoBoost: Workerpool restricted by dataset order"
        );
        require(
            _isNullIdentityOrEquals(_datasetorder.requesterrestrict, _requestorder.requester),
            "PocoBoost: Requester restricted by dataset order"
        );
        require(
            _isNullIdentityOrEquals(_workerpoolorder.apprestrict, _apporder.app),
            "PocoBoost: App restricted by workerpool order"
        );
        require(
            _isNullIdentityOrEquals(_workerpoolorder.datasetrestrict, _datasetorder.dataset),
            "PocoBoost: Dataset restricted by workerpool order"
        );
        require(
            _isNullIdentityOrEquals(_workerpoolorder.requesterrestrict, _requestorder.requester),
            "PocoBoost: Requester restricted by workerpool order"
        );

        require(m_appregistry.isRegistered(_apporder.app), "PocoBoost: App not registered");
        vars.appOwner = IERC5313(_apporder.app).owner();
        bytes32 appOrderTypedDataHash = _toTypedDataHash(_apporder.hash());
        require(
            _verifySignatureOrPresignature(vars.appOwner, appOrderTypedDataHash, _apporder.sign),
            "PocoBoost: Invalid app order signature"
        );
        bool hasDataset = _requestorder.dataset != address(0);
        bytes32 datasetOrderTypedDataHash;
        if (hasDataset) {
            require(
                m_datasetregistry.isRegistered(_datasetorder.dataset),
                "PocoBoost: Dataset not registered"
            );
            vars.datasetOwner = IERC5313(_datasetorder.dataset).owner();
            datasetOrderTypedDataHash = _toTypedDataHash(_datasetorder.hash());
            require(
                _verifySignatureOrPresignature(
                    vars.datasetOwner,
                    datasetOrderTypedDataHash,
                    _datasetorder.sign
                ),
                "PocoBoost: Invalid dataset order signature"
            );
        }
        address workerpool = _workerpoolorder.workerpool;
        require(
            m_workerpoolregistry.isRegistered(workerpool),
            "PocoBoost: Workerpool not registered"
        );
        vars.workerpoolOwner = IERC5313(workerpool).owner();
        bytes32 workerpoolOrderTypedDataHash = _toTypedDataHash(_workerpoolorder.hash());
        require(
            _verifySignatureOrPresignature(
                vars.workerpoolOwner,
                workerpoolOrderTypedDataHash,
                _workerpoolorder.sign
            ),
            "PocoBoost: Invalid workerpool order signature"
        );
        bytes32 requestOrderTypedDataHash = _toTypedDataHash(_requestorder.hash());
        require(
            _verifySignatureOrPresignature(
                _requestorder.requester,
                requestOrderTypedDataHash,
                _requestorder.sign
            ),
            "PocoBoost: Invalid request order signature"
        );
        bytes32 dealId;
        uint256 volume;
        IexecLibCore_v5.DealBoost storage deal;
        {
            /**
             * Compute deal volume and consume orders.
             * @dev
             * - Volume of the deal is equal to the smallest unconsumed volume
             *   among all orders.
             * - Compute volume:
             *   - in multiple steps to prevent `Stack too deep`
             *   - but trying to use as little gas as possible
             * - Overflows: Solidity 0.8 has built in overflow checking
             */
            uint256 requestOrderConsumed = m_consumed[requestOrderTypedDataHash];
            uint256 appOrderConsumed = m_consumed[appOrderTypedDataHash];
            // No workerpool variable, else `Stack too deep`
            // No dataset variable since dataset is optional
            dealId = keccak256(
                abi.encodePacked(
                    requestOrderTypedDataHash,
                    requestOrderConsumed // index of first task
                )
            );
            volume = _apporder.volume - appOrderConsumed;
            volume = volume.min(_workerpoolorder.volume - m_consumed[workerpoolOrderTypedDataHash]);
            volume = volume.min(_requestorder.volume - requestOrderConsumed);
            if (hasDataset) {
                volume = volume.min(_datasetorder.volume - m_consumed[datasetOrderTypedDataHash]);
            }
            require(volume > 0, "PocoBoost: One or more orders consumed");
            m_consumed[appOrderTypedDataHash] = appOrderConsumed + volume; // cheaper than `+= volume` here
            m_consumed[workerpoolOrderTypedDataHash] += volume;
            m_consumed[requestOrderTypedDataHash] = requestOrderConsumed + volume;
            if (hasDataset) {
                m_consumed[datasetOrderTypedDataHash] += volume;
            }
            /**
             * Store deal
             */
            deal = m_dealsBoost[dealId];
            deal.botFirst = requestOrderConsumed.toUint24();
        }
        deal.requester = _requestorder.requester;
        deal.workerpoolOwner = vars.workerpoolOwner;
        deal.workerpoolPrice = _workerpoolorder.workerpoolprice.toUint96();
        deal.appOwner = vars.appOwner;
        deal.appPrice = _apporder.appprice.toUint96();
        if (hasDataset) {
            deal.datasetOwner = vars.datasetOwner;
            deal.datasetPrice = _datasetorder.datasetprice.toUint96();
        }
        deal.workerReward = (((100 - IWorkerpool(workerpool).m_schedulerRewardRatioPolicy()) *
            _workerpoolorder.workerpoolprice) / 100).toUint96();
        deal.beneficiary = _requestorder.beneficiary;
        deal.deadline = (block.timestamp +
            m_categories[_requestorder.category].workClockTimeRef *
            CONTRIBUTION_DEADLINE_RATIO).toUint48();
        deal.botSize = volume.toUint24();
        /**
         * Store right part of tag for later use.
         * @dev From the cheapest to the most expensive option:
         * a. Shift left with assembly
         * b. Shift left in Solidity `tag << 160`
         * c. Convert to smaller bytes size `uint96(uint256(tag))`, see
         * https://github.com/ethereum/solidity/blob/v0.8.19/docs/types/value-types.rst?plain=1#L222
         */
        bytes12 shortTag;
        assembly {
            shortTag := shl(160, tag) // 96 = 256 - 160
        }
        deal.shortTag = shortTag;
        deal.callback = _requestorder.callback;
        // Lock
        {
            uint256 taskPrice = _apporder.appprice +
                _datasetorder.datasetprice +
                _workerpoolorder.workerpoolprice;
            lock(deal.requester, taskPrice * volume);
        }
        // Notify workerpool.
        emit SchedulerNoticeBoost(
            _requestorder.workerpool,
            dealId,
            _requestorder.app,
            _requestorder.dataset,
            _requestorder.category,
            tag,
            _requestorder.params
        );
        // Broadcast consumption of orders.
        emit OrdersMatched(
            dealId,
            appOrderTypedDataHash,
            datasetOrderTypedDataHash,
            workerpoolOrderTypedDataHash,
            requestOrderTypedDataHash,
            volume
        );
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
        uint256 index,
        bytes calldata results,
        bytes calldata resultsCallback,
        bytes calldata authorizationSign,
        address enclaveChallenge,
        bytes calldata enclaveSign
    ) external {
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealId];
        bytes32 taskId = keccak256(abi.encodePacked(dealId, index));
        require(
            m_tasks[taskId].status == IexecLibCore_v5.TaskStatusEnum.UNSET,
            "PocoBoost: Task status not unset"
        );
        require(block.timestamp < deal.deadline, "PocoBoost: Deadline reached");
        // Enclave challenge required for TEE tasks
        require(
            enclaveChallenge != address(0) || deal.shortTag[11] & 0x01 == 0,
            "PocoBoost: Tag requires enclave challenge"
        );
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
        bytes32 resultDigest = keccak256(target == address(0) ? results : resultsCallback);
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

        /**
         * @dev Prevent reentrancy before external call
         * Minimal reuse of Poco Classic task map.
         * Benefit: Fetching task status is unchanged for clients
         */
        m_tasks[taskId].status = IexecLibCore_v5.TaskStatusEnum.COMPLETED;

        // Seize requester
        seize(
            deal.requester,
            deal.workerReward, //TODO: Seize app + dataset + workerpool price
            taskId
        );
        // Reward worker
        reward(msg.sender, deal.workerReward, taskId);

        emit ResultPushedBoost(dealId, index, results);

        if (target != address(0)) {
            require(resultsCallback.length > 0, "PocoBoost: Callback requires data");
            (bool success, ) = target.call{gas: m_callbackgas}(
                abi.encodeWithSignature("receiveResult(bytes32,bytes)", taskId, resultsCallback)
            );
            success; // silent unused variable warning
            require(gasleft() > m_callbackgas / 63, "PocoBoost: Not enough gas after callback");
        }
    }

    /**
     * Claim task to get a refund if task is not completed after deadline.
     * @param dealId The ID of the deal.
     * @param index The index of the task.
     */
    function claimBoost(bytes32 dealId, uint256 index) external {
        bytes32 taskId = keccak256(abi.encodePacked(dealId, index));
        IexecLibCore_v5.Task storage task = m_tasks[taskId];
        require(
            task.status == IexecLibCore_v5.TaskStatusEnum.UNSET,
            "PocoBoost: Task status not unset"
        );
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealId];
        // If deal not found then index < 0.
        require(index < deal.botSize, "PocoBoost: Unknown task");
        require(deal.deadline <= block.timestamp, "PocoBoost: Deadline not reached");
        task.status = IexecLibCore_v5.TaskStatusEnum.FAILED;
        unlock(deal.requester, deal.appPrice + deal.datasetPrice + deal.workerpoolPrice);
        //TODO: Seize workerpool stake
        //TODO: Reward & lock kitty with seized stake
        emit TaskClaimed(taskId);
    }

    /**
     * Hash a Typed Data using the configured domain.
     * @param structHash original structure hash
     */
    function _toTypedDataHash(bytes32 structHash) internal view returns (bytes32) {
        return ECDSA.toTypedDataHash(EIP712DOMAIN_SEPARATOR, structHash);
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

    /**
     * Verify that an identity is null or equal to an expected address.
     * @param identity address to be verified
     * @param expectedAddress expected address
     */
    function _isNullIdentityOrEquals(
        address identity,
        address expectedAddress
    ) internal pure returns (bool) {
        return identity == address(0) || identity == expectedAddress; // Simple address
    }
}
