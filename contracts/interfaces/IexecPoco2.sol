// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface IexecPoco2 {
    // TODO replace `taskid` by `taskId` and update the PoCo subgraph and check
    // the impact on SDKs and Middelware.
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
