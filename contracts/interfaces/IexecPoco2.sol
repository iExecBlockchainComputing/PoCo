// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface IexecPoco2 {
    // ═══════════════════════════════════════════════════════════════════════════
    // TASK EXECUTION ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Task status is unset (not initialized)
     * @param taskId The task identifier
     */
    error TaskUnset(bytes32 taskId);

    /**
     * @notice Task already initialized
     * @param taskId The task identifier
     * @param status Current task status
     */
    error TaskAlreadyInitialized(bytes32 taskId, uint8 status);

    /**
     * @notice Task is not in ACTIVE status
     * @param taskId The task identifier
     * @param status Current task status
     */
    error TaskNotActive(bytes32 taskId, uint8 status);

    /**
     * @notice Task is not in REVEALING status
     * @param taskId The task identifier
     * @param status Current task status
     */
    error TaskNotRevealing(bytes32 taskId, uint8 status);

    /**
     * @notice Contribution deadline expired
     * @param taskId The task identifier
     * @param deadline Contribution deadline
     * @param currentTime Current block timestamp
     */
    error ContributionDeadlineExpired(bytes32 taskId, uint256 deadline, uint256 currentTime);

    /**
     * @notice Contribution already exists
     * @param taskId The task identifier
     * @param worker Worker address
     */
    error ContributionAlreadyExists(bytes32 taskId, address worker);

    /**
     * @notice Contribution not in CONTRIBUTED status
     * @param taskId The task identifier
     * @param worker Worker address
     * @param status Current contribution status
     */
    error ContributionNotContributed(bytes32 taskId, address worker, uint8 status);

    /**
     * @notice Contribution result hash mismatch
     * @param taskId The task identifier
     * @param expected Expected result hash
     * @param actual Actual result hash
     */
    error ContributionResultHashMismatch(bytes32 taskId, bytes32 expected, bytes32 actual);

    /**
     * @notice Contribution result seal mismatch
     * @param taskId The task identifier
     */
    error ContributionResultSealMismatch(bytes32 taskId);

    /**
     * @notice Enclave challenge required but not provided
     * @param taskId The task identifier
     */
    error EnclaveRequired(bytes32 taskId);

    /**
     * @notice Task index out of bounds
     * @param index Provided index
     * @param botFirst First valid index
     * @param botSize Bag of tasks size
     */
    error TaskIndexOutOfBounds(uint256 index, uint256 botFirst, uint256 botSize);

    /**
     * @notice Task deadline has been reached
     * @param deadline The deadline timestamp
     * @param currentTime Current block timestamp
     */
    error DeadlineReached(uint256 deadline, uint256 currentTime);

    /**
     * @notice Task deadline not yet reached
     * @param deadline The deadline timestamp
     * @param currentTime Current block timestamp
     */
    error DeadlineNotReached(uint256 deadline, uint256 currentTime);

    /**
     * @notice Invalid reveal conditions
     * @param taskId The task identifier
     */
    error InvalidRevealConditions(bytes32 taskId);

    /**
     * @notice Invalid reopen conditions
     * @param taskId The task identifier
     */
    error InvalidReopenConditions(bytes32 taskId);

    /**
     * @notice Contributor list must be empty for contributeAndFinalize
     * @param taskId The task identifier
     * @param contributorCount Current number of contributors
     */
    error ContributorListNotEmpty(bytes32 taskId, uint256 contributorCount);

    /**
     * @notice Trust level must be 1 for contributeAndFinalize
     * @param taskId The task identifier
     * @param trust Actual trust level
     */
    error InvalidTrustForFastFinalize(bytes32 taskId, uint256 trust);

    /**
     * @notice Invalid authorization signature
     * @param worker Worker address
     * @param taskId Task identifier
     */
    error InvalidAuthorizationSignature(address worker, bytes32 taskId);

    /**
     * @notice Invalid enclave signature
     * @param enclaveChallenge Enclave challenge address
     * @param taskId Task identifier
     */
    error InvalidEnclaveSignature(address enclaveChallenge, bytes32 taskId);

    /**
     * @notice Task cannot be claimed yet
     * @param taskId The task identifier
     * @param status Current task status
     */
    error TaskNotClaimable(bytes32 taskId, uint8 status);

    // ═══════════════════════════════════════════════════════════════════════════
    // CALLBACK ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Callback requires data but none provided
     * @param taskId The task identifier
     */
    error CallbackRequiresData(bytes32 taskId);

    /**
     * @notice Callback result digest mismatch
     * @param taskId The task identifier
     * @param expected Expected digest
     * @param actual Actual digest
     */
    error CallbackDigestMismatch(bytes32 taskId, bytes32 expected, bytes32 actual);

    // ═══════════════════════════════════════════════════════════════════════════
    // ARRAY OPERATION ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Array length mismatch
     * @param length1 First array length
     * @param length2 Second array length
     */
    error ArrayLengthMismatch(uint256 length1, uint256 length2);

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTHORIZATION ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Caller not authorized (must be workerpool owner)
     * @param caller Caller address
     * @param workerpoolOwner Expected workerpool owner
     */
    error NotWorkerpoolOwner(address caller, address workerpoolOwner);

    // TODO replace `taskid` by `taskId` and update the PoCo subgraph and check
    // the impact on SDKs and Middleware.
    event AccurateContribution(address indexed worker, bytes32 indexed taskid);
    event FaultyContribution(address indexed worker, bytes32 indexed taskid);

    event TaskInitialize(bytes32 indexed taskid, address indexed workerpool);
    event TaskContribute(bytes32 indexed taskid, address indexed worker, bytes32 hash);
    event TaskConsensus(bytes32 indexed taskid, bytes32 consensus);
    event TaskReveal(bytes32 indexed taskid, address indexed worker, bytes32 digest);
    event TaskReopen(bytes32 indexed taskid);
    event TaskFinalize(bytes32 indexed taskid, bytes results);
    event TaskClaimed(bytes32 indexed taskid);

    function initialize(bytes32 dealId, uint256 index) external returns (bytes32);

    function claim(bytes32 taskId) external;

    function contribute(
        bytes32 taskId,
        bytes32 resultHash,
        bytes32 resultSeal,
        address enclaveChallenge,
        bytes calldata enclaveSign,
        bytes calldata authorizationSign
    ) external;

    function contributeAndFinalize(
        bytes32 taskId,
        bytes32 resultDigest,
        bytes calldata results,
        bytes calldata resultsCallback, // Expansion - result separation
        address enclaveChallenge,
        bytes calldata enclaveSign,
        bytes calldata authorizationSign
    ) external; // Expansion - result separation

    function reveal(bytes32 taskId, bytes32 resultDigest) external;

    function reopen(bytes32 taskId) external;

    function finalize(
        bytes32 taskId,
        bytes calldata results,
        bytes calldata resultsCallback
    ) external;

    function initializeArray(
        bytes32[] calldata dealIds,
        uint256[] calldata indexes
    ) external returns (bool);

    function claimArray(bytes32[] calldata taskIds) external returns (bool);

    function initializeAndClaimArray(
        bytes32[] calldata dealIds,
        uint256[] calldata indexes
    ) external returns (bool);
}
