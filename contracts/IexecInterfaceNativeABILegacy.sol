// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IOwnable.sol";
import "./interfaces/IexecAccessors.sol";
import "./interfaces/IexecAccessorsABILegacy.sol";
import "./interfaces/IexecCategoryManager.sol";
import "./interfaces/IexecERC20.sol";
import "./interfaces/IexecEscrowNative.sol";
import "./interfaces/IexecConfiguration.sol";
import "./interfaces/IexecOrderManagement.sol";
import "./interfaces/IexecPoco1.sol";
import "./interfaces/IexecPoco2.sol";
import "./interfaces/IexecRelay.sol";
import "./interfaces/IexecTokenSpender.sol";

interface IexecInterfaceNativeABILegacy is
    IOwnable,
    IexecAccessors,
    IexecAccessorsABILegacy,
    IexecCategoryManager,
    IexecERC20,
    IexecEscrowNative,
    IexecConfiguration,
    IexecOrderManagement,
    IexecPoco1,
    IexecPoco2,
    IexecRelay,
    IexecTokenSpender
{}
