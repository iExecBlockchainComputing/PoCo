// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IexecPoco2 {
    event Reward(address owner, uint256 amount, bytes32 ref);
    event Seize(address owner, uint256 amount, bytes32 ref);
    event Lock(address owner, uint256 amount);
    event Unlock(address owner, uint256 amount);

    event AccurateContribution(address indexed worker, bytes32 indexed taskid);
    event FaultyContribution(address indexed worker, bytes32 indexed taskid);

    event TaskInitialize(bytes32 indexed taskid, address indexed workerpool);
    event TaskContribute(bytes32 indexed taskid, address indexed worker, bytes32 hash);
    event TaskConsensus(bytes32 indexed taskid, bytes32 consensus);
    event TaskReveal(bytes32 indexed taskid, address indexed worker, bytes32 digest);
    event TaskFinalize(bytes32 indexed taskid, bytes results);
    event TaskClaimed(bytes32 indexed taskid);
    event TaskReopen(bytes32 indexed taskid);

    function initialize(bytes32, uint256) external returns (bytes32);

    function claim(bytes32) external;

    function contribute(
        bytes32,
        bytes32,
        bytes32,
        address,
        bytes calldata,
        bytes calldata
    ) external;

    function contributeAndFinalize(
        bytes32,
        bytes32,
        bytes calldata,
        bytes calldata,
        address,
        bytes calldata,
        bytes calldata
    ) external; // Expansion - result separation

    function reveal(bytes32, bytes32) external;

    function reopen(bytes32) external;

    function finalize(bytes32, bytes calldata, bytes calldata) external;

    function initializeArray(bytes32[] calldata, uint256[] calldata) external returns (bool);

    function claimArray(bytes32[] calldata) external returns (bool);

    function initializeAndClaimArray(
        bytes32[] calldata,
        uint256[] calldata
    ) external returns (bool);
}
