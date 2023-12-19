// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {console} from "hardhat/console.sol";

pragma solidity ^0.8.0;

/**
 * @title Gas Waster Client
 * @notice This client is for testing purposes only. It simulates a callback
 * consummer client which tries to consume as much gas as available.
 */
contract GasWasterClient {
    event GotResult(bytes32 indexed id, bytes result);
    bool enabledLogs = false;
    uint256 public counter;

    function receiveResult(bytes32 id, bytes calldata result) external {
        for (uint i; i < 100; i++) {
            if (enabledLogs) {
                console.log("For i =", i, ": gasleft =", gasleft());
            }
            counter++;
        }
        emit GotResult(id, result);
    }
}
