// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC1271} from "@openzeppelin/contracts-v4/interfaces/IERC1271.sol";
import {IERC5313} from "@openzeppelin/contracts-v4/interfaces/IERC5313.sol";
import {ECDSA} from "@openzeppelin/contracts-v4/utils/cryptography/ECDSA.sol";
import {Math} from "@openzeppelin/contracts-v4/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts-v4/utils/math/SafeCast.sol";

import {IERC734} from "../../external/interfaces/IERC734.sol";
import {IOracleConsumer} from "../../external/interfaces/IOracleConsumer.sol";
import {IexecLibCore_v5} from "../../libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";
import {IWorkerpool} from "../../registries/workerpools/IWorkerpool.v8.sol";
import {DelegateBase} from "../DelegateBase.v8.sol";
import {IexecPocoBoost} from "../interfaces/IexecPocoBoost.sol";
import {IexecEscrow} from "./IexecEscrow.v8.sol";

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
     * @notice This boost match orders is only compatible with trust <= 1.
     * @param appOrder The order signed by the application developer.
     * @param datasetOrder The order signed by the dataset provider.
     * @param workerpoolOrder The order signed by the workerpool manager.
     * @param requestOrder The order signed by the requester.
     * @return The ID of the deal.
     * @dev Considering min·max·avg gas values, preferred option for deal storage
     *  is b.:
     *   - a. Use memory struct and write new struct to storage once
     *   - b. Use memory struct and write to storage field per field
     *   - c. Write/read everything to/on storage
     *   - d. Write/read everything to/on memory struct and asign memory to storage
     */
    function matchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32) {
        // Check orders compatibility

        // Ensure the trust level is within the acceptable range.
        // Only accept tasks with no replication [trust <= 1].
        require(requestOrder.trust <= 1, "PocoBoost: Bad trust level");

        // @dev An intermediate variable stored in the stack consumes
        // less gas than accessing calldata each time.
        uint256 category = requestOrder.category;
        // Check if the requested category is matched.
        require(category == workerpoolOrder.category, "PocoBoost: Category mismatch");
        // Check if the requested category is valid.
        require(category < m_categories.length, "PocoBoost: Unknown category");
        uint256 appPrice = appOrder.appprice;
        // Check if the app, dataset, and workerpool prices are within requester price limits.
        require(requestOrder.appmaxprice >= appPrice, "PocoBoost: Overpriced app");
        uint256 datasetPrice = datasetOrder.datasetprice;
        require(requestOrder.datasetmaxprice >= datasetPrice, "PocoBoost: Overpriced dataset");
        uint256 workerpoolPrice = workerpoolOrder.workerpoolprice;
        require(
            requestOrder.workerpoolmaxprice >= workerpoolPrice,
            "PocoBoost: Overpriced workerpool"
        );
        bytes32 appOrderTag = appOrder.tag;
        bytes32 tag = appOrderTag | datasetOrder.tag | requestOrder.tag;
        require(
            tag & ~workerpoolOrder.tag == 0x0,
            "PocoBoost: Workerpool tag does not match demand"
        );
        require((tag ^ appOrderTag)[31] & 0x01 == 0x0, "PocoBoost: App tag does not match demand");
        // Verify that app and dataset match requester order.
        address app = appOrder.app;
        require(requestOrder.app == app, "PocoBoost: App mismatch");
        address dataset = datasetOrder.dataset;
        address requestOrderDataset = requestOrder.dataset;
        require(requestOrderDataset == dataset, "PocoBoost: Dataset mismatch");
        // Check all possible restrictions.
        address workerpool = workerpoolOrder.workerpool;
        require(
            _isAccountAuthorizedByRestriction(requestOrder.workerpool, workerpool),
            "PocoBoost: Workerpool restricted by request order"
        );
        require(
            _isAccountAuthorizedByRestriction(appOrder.datasetrestrict, dataset),
            "PocoBoost: Dataset restricted by app order"
        );
        require(
            _isAccountAuthorizedByRestriction(appOrder.workerpoolrestrict, workerpool),
            "PocoBoost: Workerpool restricted by app order"
        );
        address requester = requestOrder.requester;
        require(
            _isAccountAuthorizedByRestriction(appOrder.requesterrestrict, requester),
            "PocoBoost: Requester restricted by app order"
        );
        require(
            _isAccountAuthorizedByRestriction(datasetOrder.apprestrict, app),
            "PocoBoost: App restricted by dataset order"
        );
        require(
            _isAccountAuthorizedByRestriction(datasetOrder.workerpoolrestrict, workerpool),
            "PocoBoost: Workerpool restricted by dataset order"
        );
        require(
            _isAccountAuthorizedByRestriction(datasetOrder.requesterrestrict, requester),
            "PocoBoost: Requester restricted by dataset order"
        );
        require(
            _isAccountAuthorizedByRestriction(workerpoolOrder.apprestrict, app),
            "PocoBoost: App restricted by workerpool order"
        );
        require(
            _isAccountAuthorizedByRestriction(workerpoolOrder.datasetrestrict, dataset),
            "PocoBoost: Dataset restricted by workerpool order"
        );
        require(
            _isAccountAuthorizedByRestriction(workerpoolOrder.requesterrestrict, requester),
            "PocoBoost: Requester restricted by workerpool order"
        );
        // Check ownership, registration, and signatures for app and dataset.
        require(m_appregistry.isRegistered(app), "PocoBoost: App not registered");
        address appOwner = IERC5313(app).owner();
        bytes32 appOrderTypedDataHash = _toTypedDataHash(appOrder.hash());
        require(
            _verifySignatureOrPresignature(appOwner, appOrderTypedDataHash, appOrder.sign),
            "PocoBoost: Invalid app order signature"
        );
        bool hasDataset = requestOrderDataset != address(0);
        address datasetOwner;
        bytes32 datasetOrderTypedDataHash;
        if (hasDataset) {
            require(m_datasetregistry.isRegistered(dataset), "PocoBoost: Dataset not registered");
            datasetOwner = IERC5313(dataset).owner();
            datasetOrderTypedDataHash = _toTypedDataHash(datasetOrder.hash());
            require(
                _verifySignatureOrPresignature(
                    datasetOwner,
                    datasetOrderTypedDataHash,
                    datasetOrder.sign
                ),
                "PocoBoost: Invalid dataset order signature"
            );
        }
        // Check ownership, registration, and signatures for workerpool.
        require(
            m_workerpoolregistry.isRegistered(workerpool),
            "PocoBoost: Workerpool not registered"
        );
        address workerpoolOwner = IERC5313(workerpool).owner();
        bytes32 workerpoolOrderTypedDataHash = _toTypedDataHash(workerpoolOrder.hash());
        require(
            _verifySignatureOrPresignature(
                workerpoolOwner,
                workerpoolOrderTypedDataHash,
                workerpoolOrder.sign
            ),
            "PocoBoost: Invalid workerpool order signature"
        );
        bytes32 requestOrderTypedDataHash = _toTypedDataHash(requestOrder.hash());
        require(
            _verifySignatureOrPresignature(requester, requestOrderTypedDataHash, requestOrder.sign),
            "PocoBoost: Invalid request order signature"
        );

        uint256 requestOrderConsumed = m_consumed[requestOrderTypedDataHash];
        uint256 appOrderConsumed = m_consumed[appOrderTypedDataHash];
        uint256 workerpoolOrderConsumed = m_consumed[workerpoolOrderTypedDataHash];
        // @dev No dataset variable since dataset is optional

        // Compute the unique deal identifier.
        bytes32 dealId = keccak256(
            abi.encodePacked(
                requestOrderTypedDataHash, // requestHash
                requestOrderConsumed // index of first task
            )
        );
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
        uint256 volume = appOrder.volume - appOrderConsumed;
        volume = volume.min(workerpoolOrder.volume - workerpoolOrderConsumed);
        volume = volume.min(requestOrder.volume - requestOrderConsumed);
        if (hasDataset) {
            volume = volume.min(datasetOrder.volume - m_consumed[datasetOrderTypedDataHash]);
        }
        require(volume > 0, "PocoBoost: One or more orders consumed");
        // Store deal (all). Write all parts of the same storage slot together
        // for gas optimization purposes.
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealId];
        deal.appOwner = appOwner;
        deal.appPrice = appPrice.toUint96();
        deal.workerpoolOwner = workerpoolOwner;
        deal.workerpoolPrice = workerpoolPrice.toUint96();
        deal.botFirst = requestOrderConsumed.toUint16();
        deal.deadline = (block.timestamp +
            m_categories[category].workClockTimeRef *
            CONTRIBUTION_DEADLINE_RATIO).toUint40();
        deal.botSize = volume.toUint16();
        /**
         * Store right part of tag for later use.
         * @dev From the cheapest to the most expensive option:
         * a. Shift left with assembly
         * b. Shift left in Solidity `tag << 232`
         * c. Convert to smaller bytes size `uint24(uint256(tag))`, see
         * https://github.com/ethereum/solidity/blob/v0.8.19/docs/types/value-types.rst?plain=1#L222
         */
        bytes3 shortTag;
        assembly {
            shortTag := shl(232, tag) // 24 = 256 - 232
        }
        deal.shortTag = shortTag;
        deal.callback = requestOrder.callback;
        deal.requester = requester;
        deal.workerReward = ((workerpoolPrice * // reward depends on
            (100 - IWorkerpool(workerpool).m_schedulerRewardRatioPolicy())) / 100).toUint96(); // worker reward ratio
        // Handle dataset-specific logic if a dataset is used.
        if (hasDataset) {
            // Store deal (dataset)
            deal.datasetOwner = datasetOwner;
            deal.datasetPrice = datasetPrice.toUint96();
            // Update consumed (dataset)
            m_consumed[datasetOrderTypedDataHash] += volume;
        }
        /**
         * Update consumed.
         * @dev Update all consumed after external call on workerpool contract
         * to prevent reentrency.
         */
        m_consumed[appOrderTypedDataHash] = appOrderConsumed + volume; // @dev cheaper than `+= volume` here
        m_consumed[workerpoolOrderTypedDataHash] = workerpoolOrderConsumed + volume;
        m_consumed[requestOrderTypedDataHash] = requestOrderConsumed + volume;
        // Lock deal price from requester balance.
        lock(requester, (appPrice + datasetPrice + workerpoolPrice) * volume);
        // Lock deal stake from scheduler balance.
        // Order is important here. First get percentage by task then
        // multiply by volume.
        lock(workerpoolOwner, ((workerpoolPrice * WORKERPOOL_STAKE_RATIO) / 100) * volume);
        // Notify workerpool.
        emit SchedulerNoticeBoost(
            workerpool,
            dealId,
            app,
            dataset,
            category,
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
        return dealId;
    }

    /**
     * @notice Accept results of a task computed by a worker during Boost workflow.
     * @param dealId The id of the target deal.
     * @param index The index of the target task of the deal.
     * @param results The results of the task computed by the worker.
     * @param resultsCallback The results of the task computed by the worker that
     * will be forwarded as call data to the callback address set by the requester.
     * @param authorizationSign The authorization signed by the scheduler.
     * authorizing the worker to push a result.
     * @param enclaveChallenge The enclave address which can produce enclave signature.
     * @param enclaveSign The signature generated from the enclave.
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
        // Compute the unique task identifier based on deal id and task index.
        bytes32 taskId = keccak256(abi.encodePacked(dealId, index));
        IexecLibCore_v5.Task storage task = m_tasks[taskId];
        // Ensure that the task exists and is in the correct state
        requireTaskExistsAndUnset(task.status, index, deal.botSize);
        require(block.timestamp < deal.deadline, "PocoBoost: Deadline reached");
        // Check that the enclave challenge is present for TEE tasks
        require(
            enclaveChallenge != address(0) || deal.shortTag[2] & 0x01 == 0,
            "PocoBoost: Tag requires enclave challenge"
        );
        address workerpoolOwner = deal.workerpoolOwner;
        // Check scheduler or TEE broker signature
        require(
            _verifySignatureOfEthSignedMessage(
                enclaveChallenge != address(0) && m_teebroker != address(0)
                    ? m_teebroker
                    : workerpoolOwner,
                abi.encodePacked(msg.sender, taskId, enclaveChallenge),
                authorizationSign
            ),
            "PocoBoost: Invalid contribution authorization signature"
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
                // @dev As long as `KITTY_RATIO = 10`, we can introduce this small
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
     * @notice Claim task to get a refund if task is not completed after deadline.
     * @param dealId The ID of the deal.
     * @param index The index of the task.
     */
    function claimBoost(bytes32 dealId, uint256 index) external {
        // Retrieve deal and task information from storage.
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealId];
        bytes32 taskId = keccak256(abi.encodePacked(dealId, index));
        IexecLibCore_v5.Task storage task = m_tasks[taskId];
        // Ensure that the task exists and has the unset status.
        requireTaskExistsAndUnset(task.status, index, deal.botSize);
        // Check if the current time has reached or passed the deadline of the deal.
        require(deal.deadline <= block.timestamp, "PocoBoost: Deadline not reached");
        // Mark the task as failed since it was not completed within the deadline.
        task.status = IexecLibCore_v5.TaskStatusEnum.FAILED;
        // Calculate workerpool price and task stake.
        uint96 workerPoolPrice = deal.workerpoolPrice;
        uint256 workerpoolTaskStake = (workerPoolPrice * WORKERPOOL_STAKE_RATIO) / 100;
        // Refund the requester by unlocking the locked funds.
        unlock(deal.requester, deal.appPrice + deal.datasetPrice + workerPoolPrice);
        // Seize task stake from workerpool.
        seize(deal.workerpoolOwner, workerpoolTaskStake, taskId);
        // Reward kitty and lock the rewarded amount.
        m_frozens[KITTY_ADDRESS] += workerpoolTaskStake;
        // Emit events to publish state changes.
        emit Reward(KITTY_ADDRESS, workerpoolTaskStake, taskId);
        emit Lock(KITTY_ADDRESS, workerpoolTaskStake);
        emit TaskClaimed(taskId);
    }

    /**
     * Hash a Typed Data using the configured domain.
     * @param structHash The original structure hash.
     */
    function _toTypedDataHash(bytes32 structHash) private view returns (bytes32) {
        return ECDSA.toTypedDataHash(EIP712DOMAIN_SEPARATOR, structHash);
    }

    /**
     * @notice Verify that an Ethereum Signed Message is signed by a particular account.
     * @param account The expected signer account.
     * @param message The original message that was signed.
     * @param signature The signature to be verified.
     */
    function _verifySignatureOfEthSignedMessage(
        address account,
        bytes memory message,
        bytes calldata signature
    ) private pure returns (bool) {
        return keccak256(message).toEthSignedMessageHash().recover(signature) == account;
    }

    /**
     * @notice Verify that a message is signed by an EOA or an ERC1271 smart contract.
     * @param account The expected signer account.
     * @param messageHash The message hash that was signed.
     * @param signature The signature to be verified.
     */
    function _verifySignature(
        address account,
        bytes32 messageHash,
        bytes calldata signature
    ) private view returns (bool) {
        if (messageHash.recover(signature) == account) {
            return true;
        }
        if (account.code.length > 0) {
            try IERC1271(account).isValidSignature(messageHash, signature) returns (bytes4 result) {
                return result == IERC1271.isValidSignature.selector;
            } catch {}
        }
        return false;
    }

    /**
     * @notice Verify that a message hash is presigned by a particular account.
     * @param account The expected presigner account.
     * @param messageHash The message hash that was presigned.
     */
    function _verifyPresignature(address account, bytes32 messageHash) private view returns (bool) {
        return account != address(0) && account == m_presigned[messageHash];
    }

    /**
     * @notice Verify that a message hash is signed or presigned by a particular account.
     * @param account The expected signer or presigner account.
     * @param messageHash The message hash that was signed or presigned.
     * @param signature The signature to be verified. Not required for a presignature.
     */
    function _verifySignatureOrPresignature(
        address account,
        bytes32 messageHash,
        bytes calldata signature
    ) private view returns (bool) {
        return
            (signature.length != 0 && _verifySignature(account, messageHash, signature)) ||
            _verifyPresignature(account, messageHash);
    }

    /**
     * @notice Verify that an account is authorized based on a given restriction.
     * The given restriction can be:
     * (1) `0x`: No restriction, accept any address;
     * (2) `0x<same-address-than-restriction>`: Only accept the exact same address;
     * (3) `0x<ERC734-contract-address>`: Accept any address in a group (having
     * the given `GROUPMEMBER` purpose) inside an ERC734 Key Manager identity
     * contract.
     * @param restriction A simple address or an ERC734 identity contract
     * that might whitelist a given address in a group.
     * @param account An address to be checked.
     */
    function _isAccountAuthorizedByRestriction(
        address restriction,
        address account
    ) private view returns (bool) {
        if (
            restriction == address(0) || // No restriction
            restriction == account // Simple address restriction
        ) {
            return true;
        }
        if (restriction.code.length > 0) {
            try
                IERC734(restriction).keyHasPurpose( // ERC734 identity contract restriction
                        bytes32(uint256(uint160(account))),
                        GROUPMEMBER_PURPOSE
                    )
            returns (bool success) {
                return success;
            } catch {}
        }
        return false;
    }

    /**
     * @notice Check if a task exists and is unset. Such task status is equivalent to
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
