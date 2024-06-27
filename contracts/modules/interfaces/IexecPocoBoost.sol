// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";

/**
 * @title Interface definition of the PoCo Boost module.
 */
interface IexecPocoBoost {
    /**
     * @notice Emitted when a set of compatible orders are matched and a new deal is created.
     * The event is watched by all workerpools, more precisely schedulers. Each scheduler
     * responds only to events with their own workerpool address. This triggers the
     * offchain computation process.
     * @dev This event has to be different from "SchedulerNotice" of Poco Classic so schedulers
     * are able to distinguish deals (Classic vs Boost).
     * @param workerpool address of the target workerpool.
     * @param dealId id of the deal created by match orders operation
     * @param app address of the application to run.
     * @param dataset address of the dataset to use. Can be address(0) for deals without dataset.
     * @param category size of the deal (duration in time).
     * @param tag type of the deal. Must be TEE tag for Boost module.
     * @param params requester input of the execution.
     * @param beneficiary address of the execution beneficiary. Used later for result encryption.
     */
    event SchedulerNoticeBoost(
        address indexed workerpool,
        bytes32 dealId,
        address app,
        address dataset,
        uint256 category,
        bytes32 tag,
        string params,
        address beneficiary
    );

    /**
     * @notice Emitted when a set of compatible orders are matched and a new deal is created.
     * An event that is watched by different actors especially the offchain marketplace
     * to update remaining volumes of available orders.
     * Note: This is the same event as Poco Classic for cross-compatibility purposes. No need
     * to use a new different event name.
     * @param dealid id of the deal created by match orders operation.
     * @param appHash hash of the app order.
     * @param datasetHash hash of the dataset order. Can be empty for deals without a dataset.
     * @param workerpoolHash hash of the workerpool order.
     * @param requestHash hash of the request order.
     * @param volume consumed volume. It should be the minimum volume of all orders.
     */
    event OrdersMatched(
        bytes32 dealid,
        bytes32 appHash,
        bytes32 datasetHash,
        bytes32 workerpoolHash,
        bytes32 requestHash,
        uint256 volume
    );

    /**
     * @notice Emitted when a worker pushes the result of a computed task in Boost mode.
     * It serves as a notification of task completion and result submission.
     * @param dealId id of the deal created by match orders operation.
     * @param index index of the task in the deal.
     * @param results bytes of the result.
     */
    event ResultPushedBoost(bytes32 dealId, uint256 index, bytes results);

    /**
     * @notice Emitted when a task is claimed. Workerpool funds are seized. Requester is refunded.
     * @dev The same event as PoCo classic for cross-compatibility purposes.
     * @param taskid id of the task to be claimed.
     */
    event TaskClaimed(bytes32 indexed taskid);

    event DealSponsoredBoost(bytes32 dealId, address sponsor);

    function matchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32);

    function sponsorMatchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32);

    function pushResultBoost(
        bytes32 dealId,
        uint256 index,
        bytes calldata results,
        bytes calldata resultsCallback,
        bytes calldata authorizationSign,
        address enclaveChallenge,
        bytes calldata enclaveSign
    ) external;

    function claimBoost(bytes32 dealId, uint256 index) external;
}
