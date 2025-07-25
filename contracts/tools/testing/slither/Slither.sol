// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecPocoAccessorsFacet} from "../../../modules/facets/IexecPocoAccessorsFacet.sol";
import {IexecPoco1Facet} from "../../../modules/facets/IexecPoco1Facet.sol";
import {IexecPoco2Facet} from "../../../modules/facets/IexecPoco2Facet.sol";

/**
 * @notice This contract is dedicated to slither analysis.
 *
 * @dev This contract aggregates multiple facet contracts into a single entry point
 *      to facilitate static analysis using Slither.
 */
//slither-disable-start unused-state
contract Slither is IexecPocoAccessorsFacet, IexecPoco1Facet, IexecPoco2Facet {}
//slither-disable-end unused-state
