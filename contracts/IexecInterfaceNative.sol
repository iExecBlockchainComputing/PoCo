// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IOwnable.sol";
import "./interfaces/IexecAccessors.sol";
import "./interfaces/IexecCategoryManager.sol";
import "./interfaces/IexecERC20.sol";
import "./interfaces/IexecEscrowNative.sol";
import "./interfaces/IexecConfiguration.sol";
import "./interfaces/IexecOrderManagement.sol";
import "./interfaces/IexecPoco1.sol";
import "./interfaces/IexecPoco2.sol";
import "./interfaces/IexecRelay.sol";
import "./interfaces/IexecTokenSpender.sol";

/**
 * A global interface that aggregates all the interfaces needed to interact with
 * the PoCo contracts in native mode.
 * @dev Referenced in the SDK with the current path `contracts/IexecInterfaceNative.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
interface IexecInterfaceNative is
    IOwnable,
    IexecAccessors,
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
