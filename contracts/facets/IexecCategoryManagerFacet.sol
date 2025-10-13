// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {FacetBase} from "./FacetBase.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
import {IexecCategoryManager} from "../interfaces/IexecCategoryManager.sol";
import {IexecLibCore_v5} from "../libs/IexecLibCore_v5.sol";

contract IexecCategoryManagerFacet is IexecCategoryManager, FacetBase {
    /**
     * Methods
     */
    function createCategory(
        string calldata name,
        string calldata description,
        uint256 workClockTimeRef
    ) external override onlyOwner returns (uint256) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_categories.push(IexecLibCore_v5.Category(name, description, workClockTimeRef));

        uint256 catid = $.m_categories.length - 1;

        emit CreateCategory(catid, name, description, workClockTimeRef);
        return catid;
    }
}
