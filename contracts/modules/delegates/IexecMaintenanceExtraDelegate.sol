// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/IexecMaintenanceExtra.sol";

contract IexecMaintenanceExtraDelegate is IexecMaintenanceExtra, DelegateBase {
    function changeRegistries(
        address _appregistryAddress,
        address _datasetregistryAddress,
        address _workerpoolregistryAddress
    ) external override onlyOwner {
        m_appregistry = IRegistry(_appregistryAddress);
        m_datasetregistry = IRegistry(_datasetregistryAddress);
        m_workerpoolregistry = IRegistry(_workerpoolregistryAddress);
    }
}
