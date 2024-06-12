// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecPocoAccessorsDelegate} from "../../../modules/delegates/IexecPocoAccessorsDelegate.sol";
import {IexecPoco1Delegate} from "../../../modules/delegates/IexecPoco1Delegate.sol";
import {IexecPoco2Delegate} from "../../../modules/delegates/IexecPoco2Delegate.sol";

/**
 * @notice This contract is dedicated to slither analysis.
 *
 * @dev This contract aggregates multiple delegate contracts into a single entry point
 *      to facilitate static analysis using Slither.
 */
//slither-disable-start unused-state
contract Slither is IexecPocoAccessorsDelegate, IexecPoco1Delegate, IexecPoco2Delegate {}
//slither-disable-start unused-state
