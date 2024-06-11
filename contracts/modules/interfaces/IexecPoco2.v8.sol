// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface IexecPoco2 {
    event TaskInitialize(bytes32 indexed taskId, address indexed workerpool);
    event TaskContribute(bytes32 indexed taskId, address indexed worker, bytes32 hash);
    event TaskConsensus(bytes32 indexed taskId, bytes32 consensus);
    event TaskReveal(bytes32 indexed taskId, address indexed worker, bytes32 digest);
    event AccurateContribution(address indexed worker, bytes32 indexed taskId);
    event FaultyContribution(address indexed worker, bytes32 indexed taskId);
    event TaskReopen(bytes32 indexed taskId);
    event TaskFinalize(bytes32 indexed taskId, bytes results);
    event TaskClaimed(bytes32 indexed taskId);

    function initialize(bytes32 dealId, uint256 index) external returns (bytes32);

    function initializeArray(
        bytes32[] calldata dealIds,
        uint256[] calldata indexes
    ) external returns (bool);

    function initializeAndClaimArray(
        bytes32[] calldata dealIds,
        uint256[] calldata indexes
    ) external returns (bool);

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
    ) external;

    function reveal(bytes32 taskId, bytes32 resultDigest) external;

    function reopen(bytes32 taskId) external;

    function finalize(
        bytes32 taskId,
        bytes calldata results,
        bytes calldata resultsCallback
    ) external;

    function claim(bytes32 taskId) external;

    function claimArray(bytes32[] calldata taskIds) external returns (bool);
}
