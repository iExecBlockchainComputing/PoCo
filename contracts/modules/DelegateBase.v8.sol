// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Store} from "../Store.v8.sol";

/**
 * @title Base contract of all Delegate contracts.
 * @dev Every module must inherit from this contract.
 */
abstract contract DelegateBase is Store {}
