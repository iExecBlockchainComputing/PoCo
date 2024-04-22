// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./modules/interfaces/IOwnable.sol";
import "./modules/interfaces/IexecAccessors.sol";
import "./modules/interfaces/IexecAccessorsABILegacy.sol";
import "./modules/interfaces/IexecCategoryManager.sol";
import "./modules/interfaces/IexecERC20.sol";
import "./modules/interfaces/IexecEscrowNative.sol";
import "./modules/interfaces/IexecMaintenance.sol";
import "./modules/interfaces/IexecOrderManagement.sol";
import "./modules/interfaces/IexecPoco1.sol";
import "./modules/interfaces/IexecPoco2.sol";
import "./modules/interfaces/IexecRelay.sol";
import "./modules/interfaces/IexecTokenSpender.sol";
import "./modules/interfaces/ENSIntegration.sol";

interface IexecInterfaceNativeABILegacy is
    IOwnable,
    IexecAccessors,
    IexecAccessorsABILegacy,
    IexecCategoryManager,
    IexecERC20,
    IexecEscrowNative,
    IexecMaintenance,
    IexecOrderManagement,
    IexecPoco1,
    IexecPoco2,
    IexecRelay,
    IexecTokenSpender,
    ENSIntegration
{}
