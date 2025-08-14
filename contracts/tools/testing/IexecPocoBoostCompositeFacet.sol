// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecPocoAccessorsFacet} from "../../facets/IexecPocoAccessorsFacet.sol";
import {IexecPocoBoostAccessorsFacet} from "../../facets/IexecPocoBoostAccessorsFacet.sol";
import {IexecPocoBoostFacet} from "../../facets/IexecPocoBoostFacet.sol";

/**
 * @notice This contract is dedicated to unit testing.
 */
contract IexecPocoBoostCompositeFacet is
    IexecPocoAccessorsFacet,
    IexecPocoBoostAccessorsFacet,
    IexecPocoBoostFacet
{}
