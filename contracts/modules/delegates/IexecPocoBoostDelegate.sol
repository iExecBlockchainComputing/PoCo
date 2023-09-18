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

import "../../external/interfaces/IOracleConsumer.sol";
import "../../registries/workerpools/IWorkerpool.v8.sol";
import "./IexecEscrow.v8.sol";
import "../DelegateBase.v8.sol";
import "../interfaces/IexecPocoBoost.sol";

/**
 * @title PoCo Boost to reduce latency and increase throughput of deals.
 * @notice Works for deals with requested trust = 0.
 */
contract IexecPocoBoostDelegate is IexecPocoBoost, DelegateBase, IexecEscrow {
    using ECDSA for bytes32;
    using Math for uint256;
    using SafeCast for uint256;
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

    /**
     * @notice This boost match orders is only compatible with trust = 0.
     * @param appOrder The order signed by the application developer
     * @param datasetOrder The order signed by the dataset provider
     * @param workerpoolOrder The order signed by the workerpool manager
     * @param requestOrder The order signed by the requester
     *
     * @dev Considering min·max·avg gas values, preferred option for deal storage
     *  is b.:
     *   - a. 213498·273978·240761: Use memory struct and write new struct to storage once
     *   - b. 213803·274283·240615: Use memory struct and write to storage field per field
     *   - c. 213990·274470·240732: Write/read everything to/on storage
     *   - d. 215729·276197·242985: Write/read everything to/on memory struct and asign memory to storage
     */
    function matchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external {
        require(requestOrder.trust == 0, "PocoBoost: Non-zero trust level");
        require(requestOrder.category == workerpoolOrder.category, "PocoBoost: Category mismatch");
        require(requestOrder.category < m_categories.length, "PocoBoost: Unknown category");
        uint256 appPrice = appOrder.appprice;
        require(requestOrder.appmaxprice >= appPrice, "PocoBoost: Overpriced app");
        uint256 datasetPrice = datasetOrder.datasetprice;
        require(requestOrder.datasetmaxprice >= datasetPrice, "PocoBoost: Overpriced dataset");
        // An intermediate variable stored in the stack consumes
        // less gas than accessing calldata each time.
        uint256 workerpoolPrice = workerpoolOrder.workerpoolprice;
        require(
            requestOrder.workerpoolmaxprice >= workerpoolPrice,
            "PocoBoost: Overpriced workerpool"
        );
        // Save some local variables in memory with a structure to fix `Stack too deep`.
        IexecLibCore_v5.DealBoost memory vars;
        bytes32 tag = appOrder.tag | datasetOrder.tag | requestOrder.tag;
        require(
            tag & ~workerpoolOrder.tag == 0x0,
            "PocoBoost: Workerpool tag does not match demand"
        );
        require((tag ^ appOrder.tag)[31] & 0x01 == 0x0, "PocoBoost: App tag does not match demand");

        // Check match and restriction
        require(requestOrder.app == appOrder.app, "PocoBoost: App mismatch");
        require(requestOrder.dataset == datasetOrder.dataset, "PocoBoost: Dataset mismatch");
        require(
            _isNullIdentityOrEquals(requestOrder.workerpool, workerpoolOrder.workerpool),
            "PocoBoost: Workerpool restricted by request order"
        );
        require(
            _isNullIdentityOrEquals(appOrder.datasetrestrict, datasetOrder.dataset),
            "PocoBoost: Dataset restricted by app order"
        );
        require(
            _isNullIdentityOrEquals(appOrder.workerpoolrestrict, workerpoolOrder.workerpool),
            "PocoBoost: Workerpool restricted by app order"
        );
        require(
            _isNullIdentityOrEquals(appOrder.requesterrestrict, requestOrder.requester),
            "PocoBoost: Requester restricted by app order"
        );
        require(
            _isNullIdentityOrEquals(datasetOrder.apprestrict, appOrder.app),
            "PocoBoost: App restricted by dataset order"
        );
        require(
            _isNullIdentityOrEquals(datasetOrder.workerpoolrestrict, workerpoolOrder.workerpool),
            "PocoBoost: Workerpool restricted by dataset order"
        );
        require(
            _isNullIdentityOrEquals(datasetOrder.requesterrestrict, requestOrder.requester),
            "PocoBoost: Requester restricted by dataset order"
        );
        require(
            _isNullIdentityOrEquals(workerpoolOrder.apprestrict, appOrder.app),
            "PocoBoost: App restricted by workerpool order"
        );
        require(
            _isNullIdentityOrEquals(workerpoolOrder.datasetrestrict, datasetOrder.dataset),
            "PocoBoost: Dataset restricted by workerpool order"
        );
        require(
            _isNullIdentityOrEquals(workerpoolOrder.requesterrestrict, requestOrder.requester),
            "PocoBoost: Requester restricted by workerpool order"
        );

        require(m_appregistry.isRegistered(appOrder.app), "PocoBoost: App not registered");
        vars.appOwner = IERC5313(appOrder.app).owner();
        bytes32 appOrderTypedDataHash = _toTypedDataHash(appOrder.hash());
        require(
            _verifySignatureOrPresignature(vars.appOwner, appOrderTypedDataHash, appOrder.sign),
            "PocoBoost: Invalid app order signature"
        );
        bool hasDataset = requestOrder.dataset != address(0);
        bytes32 datasetOrderTypedDataHash;
        if (hasDataset) {
            require(
                m_datasetregistry.isRegistered(datasetOrder.dataset),
                "PocoBoost: Dataset not registered"
            );
            vars.datasetOwner = IERC5313(datasetOrder.dataset).owner();
            datasetOrderTypedDataHash = _toTypedDataHash(datasetOrder.hash());
            require(
                _verifySignatureOrPresignature(
                    vars.datasetOwner,
                    datasetOrderTypedDataHash,
                    datasetOrder.sign
                ),
                "PocoBoost: Invalid dataset order signature"
            );
        }
        address workerpool = workerpoolOrder.workerpool;
        require(
            m_workerpoolregistry.isRegistered(workerpool),
            "PocoBoost: Workerpool not registered"
        );
        vars.workerpoolOwner = IERC5313(workerpool).owner();
        bytes32 workerpoolOrderTypedDataHash = _toTypedDataHash(workerpoolOrder.hash());
        require(
            _verifySignatureOrPresignature(
                vars.workerpoolOwner,
                workerpoolOrderTypedDataHash,
                workerpoolOrder.sign
            ),
            "PocoBoost: Invalid workerpool order signature"
        );
        bytes32 requestOrderTypedDataHash = _toTypedDataHash(requestOrder.hash());
        require(
            _verifySignatureOrPresignature(
                requestOrder.requester,
                requestOrderTypedDataHash,
                requestOrder.sign
            ),
            "PocoBoost: Invalid request order signature"
        );
        bytes32 dealId;
        uint256 volume;
        IexecLibCore_v5.DealBoost storage deal;
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
        volume = appOrder.volume - appOrderConsumed;
        volume = volume.min(workerpoolOrder.volume - m_consumed[workerpoolOrderTypedDataHash]);
        volume = volume.min(requestOrder.volume - requestOrderConsumed);
        if (hasDataset) {
            volume = volume.min(datasetOrder.volume - m_consumed[datasetOrderTypedDataHash]);
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
        deal.botFirst = requestOrderConsumed.toUint16();
        deal.requester = requestOrder.requester;
        deal.workerpoolOwner = vars.workerpoolOwner;
        deal.workerpoolPrice = workerpoolPrice.toUint96();
        deal.appOwner = vars.appOwner;
        deal.appPrice = appPrice.toUint96();
        if (hasDataset) {
            deal.datasetOwner = vars.datasetOwner;
            deal.datasetPrice = datasetPrice.toUint96();
        }
        deal.workerReward = ((workerpoolPrice * // reward depends on
            (100 - IWorkerpool(workerpool).m_schedulerRewardRatioPolicy())) / 100).toUint96(); // worker reward ratio
        deal.deadline = (block.timestamp +
            m_categories[requestOrder.category].workClockTimeRef *
            CONTRIBUTION_DEADLINE_RATIO).toUint40();
        deal.botSize = volume.toUint16();
        /**
         * Store right part of tag for later use.
         * @dev From the cheapest to the most expensive option:
         * a. Shift left with assembly
         * b. Shift left in Solidity `tag << 160`
         * c. Convert to smaller bytes size `uint96(uint256(tag))`, see
         * https://github.com/ethereum/solidity/blob/v0.8.19/docs/types/value-types.rst?plain=1#L222
         */
        bytes3 shortTag;
        assembly {
            shortTag := shl(232, tag) // 24 = 256 - 232
        }
        deal.shortTag = shortTag;
        deal.callback = requestOrder.callback;
        // Lock deal price from requester balance..
        lock(requestOrder.requester, (appPrice + datasetPrice + workerpoolPrice) * volume);
        // Lock deal stake from scheduler balance.
        // Order is important here. First get percentage by task then
        // multiply by volume.
        lock(vars.workerpoolOwner, ((workerpoolPrice * WORKERPOOL_STAKE_RATIO) / 100) * volume);
        // Notify workerpool.
        emit SchedulerNoticeBoost(
            requestOrder.workerpool,
            dealId,
            requestOrder.app,
            requestOrder.dataset,
            requestOrder.category,
            tag,
            requestOrder.params,
            requestOrder.beneficiary
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
        IexecLibCore_v5.Task storage task = m_tasks[taskId];
        requireTaskExistsAndUnset(task.status, index, deal.botSize);
        require(block.timestamp < deal.deadline, "PocoBoost: Deadline reached");
        // Enclave challenge required for TEE tasks
        require(
            enclaveChallenge != address(0) || deal.shortTag[2] & 0x01 == 0,
            "PocoBoost: Tag requires enclave challenge"
        );
        // Check scheduler signature
        address workerpoolOwner = deal.workerpoolOwner;
        require(
            _verifySignatureOfEthSignedMessage(
                workerpoolOwner,
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
        task.status = IexecLibCore_v5.TaskStatusEnum.COMPLETED;

        // Reward, seize and unlock each parties
        uint96 appPrice = deal.appPrice;
        uint96 datasetPrice = deal.datasetPrice;
        uint96 workerPoolPrice = deal.workerpoolPrice;

        // Seize requester
        seize(deal.requester, appPrice + datasetPrice + workerPoolPrice, taskId);
        uint96 workerReward = deal.workerReward;
        // Reward worker
        reward(msg.sender, workerReward, taskId);
        // Reward app developer
        if (appPrice > 0) {
            reward(deal.appOwner, appPrice, taskId);
        }
        // Reward dataset provider
        if (datasetPrice > 0) {
            reward(deal.datasetOwner, datasetPrice, taskId);
        }

        // Unlock scheduler stake
        unlock(workerpoolOwner, (workerPoolPrice * WORKERPOOL_STAKE_RATIO) / 100);
        // Reward scheduler
        uint256 kitty = m_frozens[KITTY_ADDRESS];
        if (kitty > 0) {
            kitty = KITTY_MIN // 1. retrieve bare minimum from kitty
            .max( // 2. or eventually a fraction of kitty if bigger
                /// @dev As long as `KITTY_RATIO = 10`, we can introduce this small
                kitty / KITTY_RATIO // optimization for `kitty * KITTY_RATIO / 100`
            ).min(kitty); // 3. but no more than available
            seize(KITTY_ADDRESS, kitty, taskId);
        }
        reward(
            workerpoolOwner,
            workerPoolPrice - // reward with
                workerReward + // sheduler base reward
                kitty, // and optional kitty fraction
            taskId
        );

        emit ResultPushedBoost(dealId, index, results);

        if (target != address(0)) {
            require(resultsCallback.length > 0, "PocoBoost: Callback requires data");
            /*
             * The caller must be able to complete the task even if the external
             * call reverts.
             */
            (bool success, ) = target.call{gas: m_callbackgas}(
                abi.encodeCall(IOracleConsumer.receiveResult, (taskId, resultsCallback))
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
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealId];
        bytes32 taskId = keccak256(abi.encodePacked(dealId, index));
        IexecLibCore_v5.Task storage task = m_tasks[taskId];
        requireTaskExistsAndUnset(task.status, index, deal.botSize);
        require(deal.deadline <= block.timestamp, "PocoBoost: Deadline not reached");
        task.status = IexecLibCore_v5.TaskStatusEnum.FAILED;
        uint96 workerPoolPrice = deal.workerpoolPrice;
        uint256 workerpoolTaskStake = (workerPoolPrice * WORKERPOOL_STAKE_RATIO) / 100;
        unlock(deal.requester, deal.appPrice + deal.datasetPrice + workerPoolPrice);
        seize(deal.workerpoolOwner, workerpoolTaskStake, taskId);
        // Reward kitty and lock the rewarded amount.
        //TODO: factorize this in a function
        m_frozens[KITTY_ADDRESS] += workerpoolTaskStake;
        emit Reward(KITTY_ADDRESS, workerpoolTaskStake, taskId);
        emit Lock(KITTY_ADDRESS, workerpoolTaskStake);
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

    /**
     * Check if a task exists and is unset. Such task status is equivalent to
     * the "initialized" task status in Classic Poco workflow.
     * In order for the task to exist, its index should be:
     *   0 <= index < deal.botSize.
     * @param taskStatus The status of the task.
     * @param taskIndex The index of the task.
     * @param botSize The size of the Bag-of-Task in the deal.
     */
    function requireTaskExistsAndUnset(
        IexecLibCore_v5.TaskStatusEnum taskStatus,
        uint256 taskIndex,
        uint16 botSize
    ) private pure {
        // If deal not found then index < 0.
        require(taskIndex < botSize, "PocoBoost: Unknown task");
        /***
         * @dev The calling method (A) must call this current method (B), then
         * it must update task to a higher status in (A), to prevent an account
         * to trigger (A) multiple times. Without that precaution, the contract
         * could be drained by calling (A) multiple times.
         */
        require(
            taskStatus == IexecLibCore_v5.TaskStatusEnum.UNSET,
            "PocoBoost: Task status not unset"
        );
    }
}
