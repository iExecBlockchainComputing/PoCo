// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibCore_v5} from "../../libs/IexecLibCore_v5.sol";
import {BaseFacet} from "../BaseFacet.v8.sol";
import {IexecPocoBoostAccessors} from "../interfaces/IexecPocoBoostAccessors.sol";

/**
 * @title Getters contract for PoCo Boost module.
 * @notice Access to PoCo Boost tasks must be done with PoCo Classic `IexecAccessors`.
 */
contract IexecPocoBoostAccessorsFacet is IexecPocoBoostAccessors, BaseFacet {
    /**
     * Get a deal created by PoCo Boost module.
     * @param id The ID of the deal.
     */
    function viewDealBoost(
        bytes32 id
    ) external view returns (IexecLibCore_v5.DealBoost memory deal) {
        return m_dealsBoost[id];
    }
}
