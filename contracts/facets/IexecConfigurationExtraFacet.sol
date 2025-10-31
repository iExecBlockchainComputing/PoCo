// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {FacetBase} from "./FacetBase.sol";
import {IexecConfigurationExtra} from "../interfaces/IexecConfigurationExtra.sol";
import {IRegistry} from "../registries/IRegistry.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";

contract IexecConfigurationExtraFacet is IexecConfigurationExtra, FacetBase {
    function changeRegistries(
        address _appregistryAddress,
        address _datasetregistryAddress,
        address _workerpoolregistryAddress
    ) external override onlyOwner {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_appregistry = IRegistry(_appregistryAddress);
        $.m_datasetregistry = IRegistry(_datasetregistryAddress);
        $.m_workerpoolregistry = IRegistry(_workerpoolregistryAddress);
    }
}
