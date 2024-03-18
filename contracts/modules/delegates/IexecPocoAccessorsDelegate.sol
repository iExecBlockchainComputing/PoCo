// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibCore_v5} from "../../libs/IexecLibCore_v5.sol";
import {DelegateBase} from "../DelegateBase.v8.sol";
import {IexecPocoBoostAccessors} from "../interfaces/IexecPocoAccessors.sol";

/**
 * @title Getters contract for PoCo module.
 */
contract IexecPocoAccessorsDelegate is IexecPocoBoostAccessors, DelegateBase {
    /**
     * Get a deal created by PoCo module.
     * @param id The ID of the deal.
     */
    function viewDeal(bytes32 id) external view returns (IexecLibCore_v5.Deal memory deal) {
        return m_deals[id];
    }
}
