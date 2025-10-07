// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecAccessorsABILegacy} from "./interfaces/IexecAccessorsABILegacy.sol";
import {IexecCategoryManager} from "./interfaces/IexecCategoryManager.sol";
import {IexecConfiguration} from "./interfaces/IexecConfiguration.sol";
import {IexecConfigurationExtra} from "./interfaces/IexecConfigurationExtra.sol";
import {IexecERC20} from "./interfaces/IexecERC20.sol";
import {IexecERC20Common} from "./interfaces/IexecERC20Common.sol";
import {IexecEscrowToken} from "./interfaces/IexecEscrowToken.sol";
import {IexecOrderManagement} from "./interfaces/IexecOrderManagement.sol";
import {IexecPoco1} from "./interfaces/IexecPoco1.sol";
import {IexecPoco2} from "./interfaces/IexecPoco2.sol";
import {IexecPocoAccessors} from "./interfaces/IexecPocoAccessors.sol";
import {IexecRelay} from "./interfaces/IexecRelay.sol";
import {IexecTokenSpender} from "./interfaces/IexecTokenSpender.sol";
import {IOwnable} from "./interfaces/IOwnable.sol";

/**
 * A global interface that aggregates all the interfaces needed to interact with
 * the PoCo contracts in token mode.
 * @dev Referenced in the SDK with the current path `contracts/IexecInterfaceToken.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
interface IexecInterfaceToken is
    // TODO: Remove this interface when it's not used in the middelware anymore.
    // https://github.com/iExecBlockchainComputing/iexec-commons-poco/blob/819cd008/generateContractWrappers#L7
    IexecAccessorsABILegacy,
    IexecCategoryManager,
    IexecConfiguration,
    IexecConfigurationExtra,
    IexecERC20,
    IexecERC20Common,
    IexecEscrowToken,
    IexecOrderManagement,
    IexecPoco1,
    IexecPoco2,
    IexecPocoAccessors,
    IexecRelay,
    IexecTokenSpender,
    IOwnable
{}
