// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

/**
 * iExec PoCo v3 interface.
 */
interface IexecHubInterface {
    function viewScore(address worker) external returns (uint256);
}
