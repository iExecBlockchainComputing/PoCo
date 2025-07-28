// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../FacetBase.sol";
import {LibPocoStorage} from "../../libs/LibPocoStorage.sol";
import "../interfaces/IexecCategoryManager.sol";

contract IexecCategoryManagerFacet is IexecCategoryManager, FacetBase {
    /**
     * Methods
     */
    function createCategory(
        string calldata name,
        string calldata description,
        uint256 workClockTimeRef
    ) external override onlyOwner returns (uint256) {
        LibPocoStorage.addCategory(IexecLibCore_v5.Category(name, description, workClockTimeRef));

        uint256 catid = LibPocoStorage.categories().length - 1;

        emit CreateCategory(catid, name, description, workClockTimeRef);
        return catid;
    }
}
