// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts-v5/access/Ownable.sol";

import {Store} from "../Store.v8.sol";

/**
 * @title Base contract of all Delegate contracts.
 * @dev Every module must inherit from this contract.
 */
abstract contract DelegateBase is Store {
    /**
     * @dev Constructor used by all PoCo modules.
     */
    constructor() Ownable(msg.sender) {
        renounceOwnership();
    }
}
