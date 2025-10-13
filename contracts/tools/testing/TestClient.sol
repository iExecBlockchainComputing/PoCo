// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IOracleConsumer} from "../../external/interfaces/IOracleConsumer.sol";

contract TestClient is IOracleConsumer {
    event GotResult(bytes32 indexed id, bytes result);

    mapping(bytes32 => uint256) public gstore;
    mapping(bytes32 => bytes) public store;

    function receiveResult(bytes32 id, bytes calldata result) external override {
        gstore[id] = gasleft();
        store[id] = result;
        emit GotResult(id, result);
    }
}
