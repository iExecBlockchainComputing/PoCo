// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH

pragma solidity ^0.8.0;

import {Store} from "../Store.v8.sol";

/**
 * @title Base contract of all Delegate contracts.
 * @dev Every module must inherit from this contract.
 */
abstract contract DelegateBase is Store {
    /**
     * @dev constructor used by all PoCo modules.
     */
    constructor() {
        renounceOwnership();
    }
}
