// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

/**
 * @title Interface definition of the PoCo Boost facet.
 */
// TODO add this to IexecInterfaceToken when the facet is deployed.
interface IexecPocoBoost {
    // ═══════════════════════════════════════════════════════════════════════════
    // ORDER MATCHING ERRORS - POCO V1 (Classic)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Category mismatch between request and workerpool orders
     * @param requestCategory Category from request order
     * @param workerpoolCategory Category from workerpool order
     */
    error PocoBoost__CategoryMismatch(uint256 requestCategory, uint256 workerpoolCategory);

    /**
     * @notice Unknown category
     * @param category The invalid category ID
     * @param maxCategory Maximum valid category ID
     */
    error PocoBoost__UnknownCategory(uint256 category, uint256 maxCategory);

    /**
     * @notice Trust level mismatch
     * @param requestTrust Trust level from request order
     * @param workerpoolTrust Trust level from workerpool order
     */
    error PocoBoost__TrustMismatch(uint256 requestTrust, uint256 workerpoolTrust);

    /**
     * @notice App price exceeds maximum price in request order
     * @param appPrice Actual app price
     * @param maxPrice Maximum price from request order
     */
    error PocoBoost__AppPriceTooHigh(uint256 appPrice, uint256 maxPrice);

    /**
     * @notice Dataset price exceeds maximum price in request order
     * @param datasetPrice Actual dataset price
     * @param maxPrice Maximum price from request order
     */
    error PocoBoost__DatasetPriceTooHigh(uint256 datasetPrice, uint256 maxPrice);

    /**
     * @notice Workerpool price exceeds maximum price in request order
     * @param workerpoolPrice Actual workerpool price
     * @param maxPrice Maximum price from request order
     */
    error PocoBoost__WorkerpoolPriceTooHigh(uint256 workerpoolPrice, uint256 maxPrice);

    /**
     * @notice Tag requirements not satisfied by workerpool
     * @param requiredTag Required tag from request
     * @param workerpoolTag Workerpool tag
     */
    error PocoBoost__TagMismatch(bytes32 requiredTag, bytes32 workerpoolTag);

    /**
     * @notice App tag TEE requirement mismatch
     * @param requestTag Request order tag
     * @param appTag App order tag
     */
    error PocoBoost__AppTagMismatch(bytes32 requestTag, bytes32 appTag);

    /**
     * @notice App address mismatch
     * @param requestApp App from request order
     * @param orderApp App from app order
     */
    error PocoBoost__AppMismatch(address requestApp, address orderApp);

    /**
     * @notice Dataset address mismatch
     * @param requestDataset Dataset from request order
     * @param orderDataset Dataset from dataset order
     */
    error PocoBoost__DatasetMismatch(address requestDataset, address orderDataset);

    /**
     * @notice Workerpool address mismatch
     * @param requestWorkerpool Workerpool from request order
     * @param orderWorkerpool Workerpool from workerpool order
     */
    error PocoBoost__WorkerpoolMismatch(address requestWorkerpool, address orderWorkerpool);

    /**
     * @notice Dataset restriction not satisfied
     * @param restriction Restriction address (or zero for any)
     * @param actual Actual dataset address
     */
    error PocoBoost__DatasetRestrictionMismatch(address restriction, address actual);

    /**
     * @notice Workerpool restriction not satisfied
     * @param restriction Restriction address (or zero for any)
     * @param actual Actual workerpool address
     */
    error PocoBoost__WorkerpoolRestrictionMismatch(address restriction, address actual);

    /**
     * @notice Requester restriction not satisfied
     * @param restriction Restriction address (or zero for any)
     * @param actual Actual requester address
     */
    error PocoBoost__RequesterRestrictionMismatch(address restriction, address actual);

    /**
     * @notice App restriction not satisfied
     * @param restriction Restriction address (or zero for any)
     * @param actual Actual app address
     */
    error PocoBoost__AppRestrictionMismatch(address restriction, address actual);

    /**
     * @notice App not registered in registry
     * @param app App address
     */
    error PocoBoost__AppNotRegistered(address app);

    /**
     * @notice Dataset not registered in registry
     * @param dataset Dataset address
     */
    error PocoBoost__DatasetNotRegistered(address dataset);

    /**
     * @notice Workerpool not registered in registry
     * @param workerpool Workerpool address
     */
    error PocoBoost__WorkerpoolNotRegistered(address workerpool);

    /**
     * @notice One or more orders are fully consumed
     */
    error PocoBoost__OrdersConsumed();

    // ═══════════════════════════════════════════════════════════════════════════
    // ORDER MATCHING ERRORS - POCO BOOST
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Invalid trust level for boost (must be <= 1)
     * @param trust The invalid trust level
     */
    error PocoBoost__BadTrustLevel(uint256 trust);

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNATURE ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Invalid signature format
     */
    error PocoBoost__InvalidSignatureFormat();

    /**
     * @notice Invalid signature
     * @param signer Expected signer address
     * @param hash Message hash
     */
    error PocoBoost__InvalidSignature(address signer, bytes32 hash);

    /**
     * @notice Invalid app order signature
     * @param appOwner Expected app owner address
     * @param apporderHash App order hash
     */
    error PocoBoost__InvalidAppOrderSignature(address appOwner, bytes32 apporderHash);

    /**
     * @notice Invalid dataset order signature
     * @param datasetOwner Expected dataset owner address
     * @param datasetorderHash Dataset order hash
     */
    error PocoBoost__InvalidDatasetOrderSignature(address datasetOwner, bytes32 datasetorderHash);

    /**
     * @notice Invalid workerpool order signature
     * @param workerpoolOwner Expected workerpool owner address
     * @param workerpoolorderHash Workerpool order hash
     */
    error PocoBoost__InvalidWorkerpoolOrderSignature(
        address workerpoolOwner,
        bytes32 workerpoolorderHash
    );

    /**
     * @notice Invalid request order signature
     * @param requester Expected requester address
     * @param requestorderHash Request order hash
     */
    error PocoBoost__InvalidRequestOrderSignature(address requester, bytes32 requestorderHash);

    // ═══════════════════════════════════════════════════════════════════════════
    // DATASET COMPATIBILITY ERRORS (from IexecPoco1Errors.sol)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Dataset order incompatible with deal
     * @param reason Description of the incompatibility
     */
    error PocoBoost__IncompatibleDatasetOrder(string reason);

    // ═══════════════════════════════════════════════════════════════════════════
    // POCO BOOST ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Task index out of bounds
     * @param index Provided index
     * @param botSize Bag of tasks size
     */
    error PocoBoost__UnknownTask(uint256 index, uint256 botSize);

    /**
     * @notice Task status is not UNSET
     * @param status Current task status
     */
    error PocoBoost__TaskStatusNotUnset(uint8 status);

    /**
     * @notice Tag requires enclave challenge but none provided
     */
    error PocoBoost__TagRequiresEnclaveChallenge();

    /**
     * @notice Invalid contribution authorization signature
     */
    error PocoBoost__InvalidContributionAuthorizationSignature();

    /**
     * @notice Invalid enclave signature
     */
    error PocoBoost__InvalidEnclaveSignature();

    /**
     * @notice Callback requires data but none provided
     */
    error PocoBoost__CallbackRequiresData();

    /**
     * @notice Not enough gas remaining after callback execution
     */
    error PocoBoost__NotEnoughGasAfterCallback();

    /**
     * @notice Task deadline has been reached
     * @param deadline The deadline timestamp
     * @param currentTime Current block timestamp
     */
    error PocoBoost__DeadlineReached(uint256 deadline, uint256 currentTime);

    /**
     * @notice Task deadline not yet reached
     * @param deadline The deadline timestamp
     * @param currentTime Current block timestamp
     */
    error PocoBoost__DeadlineNotReached(uint256 deadline, uint256 currentTime);

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

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
