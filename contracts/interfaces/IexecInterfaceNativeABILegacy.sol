// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./IOwnable.sol";
import "./IexecAccessors.sol";
import "./IexecAccessorsABILegacy.sol";
import "./IexecCategoryManager.sol";
import "./IexecERC20.sol";
import "./IexecEscrowNative.sol";
import "./IexecConfiguration.sol";
import "./IexecOrderManagement.sol";
import "./IexecPoco1.sol";
import "./IexecPoco2.sol";
import "./IexecRelay.sol";
import "./IexecTokenSpender.sol";

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
