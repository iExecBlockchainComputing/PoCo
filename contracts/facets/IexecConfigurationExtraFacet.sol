// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./FacetBase.sol";
import "../interfaces/IexecConfigurationExtra.sol";
import {LibPocoStorage} from "../libs/LibPocoStorage.sol";

contract IexecConfigurationExtraFacet is IexecConfigurationExtra, FacetBase {
    function changeRegistries(
        address _appregistryAddress,
        address _datasetregistryAddress,
        address _workerpoolregistryAddress
    ) external override onlyOwner {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        $.m_appregistry = IRegistry(_appregistryAddress);
        $.m_datasetregistry = IRegistry(_datasetregistryAddress);
        $.m_workerpoolregistry = IRegistry(_workerpoolregistryAddress);
    }
}
