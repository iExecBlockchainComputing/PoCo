// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

interface IexecPoco1 {
    // ═══════════════════════════════════════════════════════════════════════════
    // ORDER MATCHING ERRORS - POCO V1 (Classic)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Category mismatch between request and workerpool orders
     * @param requestCategory Category from request order
     * @param workerpoolCategory Category from workerpool order
     */
    error CategoryMismatch(uint256 requestCategory, uint256 workerpoolCategory);

    /**
     * @notice Unknown category
     * @param category The invalid category ID
     * @param maxCategory Maximum valid category ID
     */
    error UnknownCategory(uint256 category, uint256 maxCategory);

    /**
     * @notice Trust level mismatch
     * @param requestTrust Trust level from request order
     * @param workerpoolTrust Trust level from workerpool order
     */
    error TrustMismatch(uint256 requestTrust, uint256 workerpoolTrust);

    /**
     * @notice App price exceeds maximum price in request order
     * @param appPrice Actual app price
     * @param maxPrice Maximum price from request order
     */
    error AppPriceTooHigh(uint256 appPrice, uint256 maxPrice);

    /**
     * @notice Dataset price exceeds maximum price in request order
     * @param datasetPrice Actual dataset price
     * @param maxPrice Maximum price from request order
     */
    error DatasetPriceTooHigh(uint256 datasetPrice, uint256 maxPrice);

    /**
     * @notice Workerpool price exceeds maximum price in request order
     * @param workerpoolPrice Actual workerpool price
     * @param maxPrice Maximum price from request order
     */
    error WorkerpoolPriceTooHigh(uint256 workerpoolPrice, uint256 maxPrice);

    /**
     * @notice Tag requirements not satisfied by workerpool
     * @param requiredTag Required tag from request
     * @param workerpoolTag Workerpool tag
     */
    error TagMismatch(bytes32 requiredTag, bytes32 workerpoolTag);

    /**
     * @notice App tag TEE requirement mismatch
     * @param requestTag Request order tag
     * @param appTag App order tag
     */
    error AppTagMismatch(bytes32 requestTag, bytes32 appTag);

    /**
     * @notice App address mismatch
     * @param requestApp App from request order
     * @param orderApp App from app order
     */
    error AppMismatch(address requestApp, address orderApp);

    /**
     * @notice Dataset address mismatch
     * @param requestDataset Dataset from request order
     * @param orderDataset Dataset from dataset order
     */
    error DatasetMismatch(address requestDataset, address orderDataset);

    /**
     * @notice Workerpool address mismatch
     * @param requestWorkerpool Workerpool from request order
     * @param orderWorkerpool Workerpool from workerpool order
     */
    error WorkerpoolMismatch(address requestWorkerpool, address orderWorkerpool);

    /**
     * @notice Dataset restriction not satisfied
     * @param restriction Restriction address (or zero for any)
     * @param actual Actual dataset address
     */
    error DatasetRestrictionMismatch(address restriction, address actual);

    /**
     * @notice Workerpool restriction not satisfied
     * @param restriction Restriction address (or zero for any)
     * @param actual Actual workerpool address
     */
    error WorkerpoolRestrictionMismatch(address restriction, address actual);

    /**
     * @notice Requester restriction not satisfied
     * @param restriction Restriction address (or zero for any)
     * @param actual Actual requester address
     */
    error RequesterRestrictionMismatch(address restriction, address actual);

    /**
     * @notice App restriction not satisfied
     * @param restriction Restriction address (or zero for any)
     * @param actual Actual app address
     */
    error AppRestrictionMismatch(address restriction, address actual);

    /**
     * @notice App not registered in registry
     * @param app App address
     */
    error AppNotRegistered(address app);

    /**
     * @notice Dataset not registered in registry
     * @param dataset Dataset address
     */
    error DatasetNotRegistered(address dataset);

    /**
     * @notice Workerpool not registered in registry
     * @param workerpool Workerpool address
     */
    error WorkerpoolNotRegistered(address workerpool);

    /**
     * @notice One or more orders are fully consumed
     */
    error OrdersConsumed();

    // ═══════════════════════════════════════════════════════════════════════════
    // ORDER MATCHING ERRORS - POCO BOOST
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Invalid trust level for boost (must be <= 1)
     * @param trust The invalid trust level
     */
    error BadTrustLevel(uint256 trust);

    // ═══════════════════════════════════════════════════════════════════════════
    // SIGNATURE ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Invalid app order signature
     * @param appOwner Expected app owner address
     * @param apporderHash App order hash
     */
    error InvalidAppOrderSignature(address appOwner, bytes32 apporderHash);

    /**
     * @notice Invalid dataset order signature
     * @param datasetOwner Expected dataset owner address
     * @param datasetorderHash Dataset order hash
     */
    error InvalidDatasetOrderSignature(address datasetOwner, bytes32 datasetorderHash);

    /**
     * @notice Invalid workerpool order signature
     * @param workerpoolOwner Expected workerpool owner address
     * @param workerpoolorderHash Workerpool order hash
     */
    error InvalidWorkerpoolOrderSignature(address workerpoolOwner, bytes32 workerpoolorderHash);

    /**
     * @notice Invalid request order signature
     * @param requester Expected requester address
     * @param requestorderHash Request order hash
     */
    error InvalidRequestOrderSignature(address requester, bytes32 requestorderHash);

    // ═══════════════════════════════════════════════════════════════════════════
    // DATASET COMPATIBILITY ERRORS (from IexecPoco1Errors.sol)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Dataset order incompatible with deal
     * @param reason Description of the incompatibility
     */
    error IncompatibleDatasetOrder(string reason);

    event SchedulerNotice(address indexed workerpool, bytes32 dealid);
    event OrdersMatched(
        bytes32 dealid,
        bytes32 appHash,
        bytes32 datasetHash,
        bytes32 workerpoolHash,
        bytes32 requestHash,
        uint256 volume
    );
    event DealSponsored(bytes32 dealId, address sponsor);

    function verifySignature(address, bytes32, bytes calldata) external view returns (bool);

    function verifyPresignature(address, bytes32) external view returns (bool);

    function verifyPresignatureOrSignature(
        address,
        bytes32,
        bytes calldata
    ) external view returns (bool);

    function assertDatasetDealCompatibility(
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        bytes32 dealId
    ) external view;

    function matchOrders(
        IexecLibOrders_v5.AppOrder calldata,
        IexecLibOrders_v5.DatasetOrder calldata,
        IexecLibOrders_v5.WorkerpoolOrder calldata,
        IexecLibOrders_v5.RequestOrder calldata
    ) external returns (bytes32);

    function sponsorMatchOrders(
        IexecLibOrders_v5.AppOrder calldata,
        IexecLibOrders_v5.DatasetOrder calldata,
        IexecLibOrders_v5.WorkerpoolOrder calldata,
        IexecLibOrders_v5.RequestOrder calldata
    ) external returns (bytes32);
}
