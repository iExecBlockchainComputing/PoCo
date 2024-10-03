// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC5313} from "@openzeppelin/contracts-v5/interfaces/IERC5313.sol";
import {ECDSA} from "@openzeppelin/contracts-v5/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts-v5/utils/cryptography/MessageHashUtils.sol";
import {Math} from "@openzeppelin/contracts-v5/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts-v5/utils/math/SafeCast.sol";

import {IOracleConsumer} from "../../external/interfaces/IOracleConsumer.sol";
import {IexecLibCore_v5} from "../../libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";
import {IWorkerpool} from "../../registries/workerpools/IWorkerpool.v8.sol";
import {DelegateBase} from "../DelegateBase.v8.sol";
import {IexecPocoBoost} from "../interfaces/IexecPocoBoost.sol";
import {IexecEscrow} from "./IexecEscrow.v8.sol";
import {IexecPocoCommonDelegate} from "./IexecPocoCommonDelegate.sol";
import {SignatureVerifier} from "./SignatureVerifier.v8.sol";

/**
 * @title PoCo Boost to reduce latency and increase throughput of deals.
 * @notice Works for deals with requested trust = 0.
 */
contract IexecPocoBoostDelegate is
    IexecPocoBoost,
    DelegateBase,
    IexecEscrow,
    SignatureVerifier,
    IexecPocoCommonDelegate
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using Math for uint256;
    using SafeCast for uint256;
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

    /**
     * @notice This boost match orders is only compatible with trust <= 1.
     * The requester gets debited.
     * @param appOrder The order signed by the application developer.
     * @param datasetOrder The order signed by the dataset provider.
     * @param workerpoolOrder The order signed by the workerpool manager.
     * @param requestOrder The order signed by the requester.
     * @return The ID of the deal.
     */
    function matchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32) {
        return
            _matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
                requestOrder.requester
            );
    }

    /**
     * Sponsor match orders boost for a requester.
     * Unlike the standard `matchOrdersBoost(..)` hook where the requester pays for
     * the deal, this current hook makes it possible for any `msg.sender` to pay for
     * a third party requester.
     *
     * @notice Be aware that anyone seeing a valid request order on the network
     * (via an off-chain public marketplace, via a `sponsorMatchOrdersBoost(..)`
     * pending transaction in the mempool or by any other means) might decide
     * to call the standard `matchOrdersBoost(..)` hook which will result in the
     * requester being debited instead. Therefore, such a front run would result
     * in a loss of some of the requester funds deposited in the iExec account
     * (a loss value equivalent to the price of the deal).
     *
     * @param appOrder The app order.
     * @param datasetOrder The dataset order.
     * @param workerpoolOrder The workerpool order.
     * @param requestOrder The requester order.
     */

    function sponsorMatchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32) {
        address sponsor = msg.sender;
        bytes32 dealId = _matchOrdersBoost(
            appOrder,
            datasetOrder,
            workerpoolOrder,
            requestOrder,
            sponsor
        );
        emit DealSponsoredBoost(dealId, sponsor);
        return dealId;
    }

    /**
     * Match orders boost and specify a sponsor in charge of paying for the deal.
     *
     * @param appOrder The app order.
     * @param datasetOrder The dataset order.
     * @param workerpoolOrder The workerpool order.
     * @param requestOrder The requester order.
     * @param sponsor The sponsor in charge of paying the deal.
     * @dev Considering min·max·avg gas values, preferred option for deal storage
     *  is b.:
     *   - a. Use memory struct and write new struct to storage once
     *   - b. Use memory struct and write to storage field per field
     *   - c. Write/read everything to/on storage
     *   - d. Write/read everything to/on memory struct and asign memory to storage
     */
    function _matchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder,
        address sponsor
    ) private returns (bytes32) {
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
        require(requestOrder.dataset == dataset, "PocoBoost: Dataset mismatch");
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
        bool hasDataset = dataset != address(0);
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
        uint256 volume = _computeDealVolume(
            appOrder.volume,
            appOrderTypedDataHash,
            hasDataset,
            datasetOrder.volume,
            datasetOrderTypedDataHash,
            workerpoolOrder.volume,
            workerpoolOrderTypedDataHash,
            requestOrder.volume,
            requestOrderTypedDataHash
        );
        require(volume > 0, "PocoBoost: One or more orders consumed");
        // Store deal (all). Write all parts of the same storage slot together
        // for gas optimization purposes.
        IexecLibCore_v5.DealBoost storage deal = m_dealsBoost[dealId];
        deal.appOwner = appOwner;
        deal.appPrice = appPrice.toUint96();
        deal.workerpoolOwner = workerpoolOwner;
        deal.workerpoolPrice = workerpoolPrice.toUint96();
        deal.workerReward = ((workerpoolPrice * // reward depends on
            (100 - IWorkerpool(workerpool).m_schedulerRewardRatioPolicy())) / 100).toUint96(); // worker reward ratio
        deal.requester = requester;
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
        //slither-disable-next-line assembly
        assembly {
            shortTag := shl(232, tag) // 24 = 256 - 232
        }
        deal.shortTag = shortTag;
        deal.callback = requestOrder.callback;
        // Handle dataset-specific logic if a dataset is used.
        if (hasDataset) {
            // Store deal (dataset)
            deal.datasetOwner = datasetOwner;
            deal.datasetPrice = datasetPrice.toUint96();
            // Update consumed (dataset)
            m_consumed[datasetOrderTypedDataHash] += volume;
        }
        deal.sponsor = sponsor;
        /**
         * Update consumed.
         * @dev Update all consumed after external call on workerpool contract
         * to prevent reentrancy.
         */
        m_consumed[appOrderTypedDataHash] = appOrderConsumed + volume; // @dev cheaper than `+= volume` here
        m_consumed[workerpoolOrderTypedDataHash] = workerpoolOrderConsumed + volume;
        m_consumed[requestOrderTypedDataHash] = requestOrderConsumed + volume;
        // Lock deal price from sponsor balance.
        lock(sponsor, (appPrice + datasetPrice + workerpoolPrice) * volume);
        // Lock deal stake from scheduler balance.
        // Order is important here. First get percentage by task then
        // multiply by volume.
        //slither-disable-next-line divide-before-multiply
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
            // See Halborn audit report for details
            //slither-disable-next-line low-level-calls
            (bool success, ) = target.call{gas: m_callbackgas}(
                abi.encodeCall(IOracleConsumer.receiveResult, (taskId, resultsCallback))
            );
            //slither-disable-next-line redundant-statements
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
        // Refund the payer of the task by unlocking the locked funds.
        unlock(deal.sponsor, deal.appPrice + deal.datasetPrice + workerPoolPrice);
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
