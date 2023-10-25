// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH

pragma solidity ^0.8.0;

/**
 * @title Predefined interface of a contract that consumes the callback value
 * submitted through a push result operation.
 */
interface IOracleConsumer {
    /**
     * Function called by the PoCo's contract to consume the callback value.
     * @param taskId id of the task.
     * @param resultsCallback payload of the callback value.
     */
    function receiveResult(bytes32 taskId, bytes calldata resultsCallback) external;
}
