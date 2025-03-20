// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;

import "../Store.sol";
import {OwnableDiamondStore} from "../OwnableDiamondStore.sol";

abstract contract DelegateBase is Store, OwnableDiamondStore {}
