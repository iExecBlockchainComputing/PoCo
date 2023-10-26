// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

/**
 * @title Predefined interface of a contract that consumes the callback value
 * submitted through a push result operation.
 */
interface IOracleConsumer {
    /**
     * Function called by PoCo contracts to consume the callback value.
     * @param taskId id of the task.
     * @param resultsCallback payload of the callback value.
     */
    function receiveResult(bytes32 taskId, bytes calldata resultsCallback) external;
}
