// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecPocoBoostAccessorsDelegate} from "../../../modules/delegates/IexecPocoBoostAccessorsDelegate.sol";
import {IexecPocoBoostDelegate} from "../../../modules/delegates/IexecPocoBoostDelegate.sol";

/**
 * @notice This contract is dedicated to slither analysis.
 *
 * @dev This contract aggregates multiple delegate contracts into a single entry point
 *      to facilitate static analysis using Slither.
 */
contract SlitherBoost is IexecPocoBoostDelegate, IexecPocoBoostAccessorsDelegate {}
