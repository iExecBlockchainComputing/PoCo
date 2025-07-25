// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecPocoBoostAccessorsFacet} from "../../../modules/facets/IexecPocoBoostAccessorsFacet.sol";
import {IexecPocoBoostFacet} from "../../../modules/facets/IexecPocoBoostFacet.sol";

/**
 * @notice This contract is dedicated to slither analysis.
 *
 * @dev This contract aggregates multiple facet contracts into a single entry point
 *      to facilitate static analysis using Slither.
 */
//slither-disable-start unused-state
contract SlitherBoost is IexecPocoBoostFacet, IexecPocoBoostAccessorsFacet {}
//slither-disable-end unused-state
