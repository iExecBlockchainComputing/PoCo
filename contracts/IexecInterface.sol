// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecAccessorsABILegacy} from "./interfaces/IexecAccessorsABILegacy.sol";
import {IexecCategoryManager} from "./interfaces/IexecCategoryManager.sol";
import {IexecConfiguration} from "./interfaces/IexecConfiguration.sol";
import {IexecConfigurationExtra} from "./interfaces/IexecConfigurationExtra.sol";
import {IexecEscrow} from "./interfaces/IexecEscrow.sol";
import {IexecEscrowEvents} from "./interfaces/IexecEscrowEvents.sol";
import {IexecOrderManagement} from "./interfaces/IexecOrderManagement.sol";
import {IexecPoco1} from "./interfaces/IexecPoco1.sol";
import {IexecPoco2} from "./interfaces/IexecPoco2.sol";
import {IexecPocoAccessors} from "./interfaces/IexecPocoAccessors.sol";
import {IexecRelay} from "./interfaces/IexecRelay.sol";
import {IexecTokenSpender} from "./interfaces/IexecTokenSpender.sol";
import {IOwnable} from "./interfaces/IOwnable.sol";

/**
 * A global interface that aggregates all the interfaces needed to interact with
 * the PoCo contracts.
 * @dev TODO Referenced in the SDK with the old path `contracts/IexecInterfaceToken.sol`.
 * The SDK should be updated to use the new path `contracts/IexecInterface.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
// TODO Remove the interface `IexecAccessorsABILegacy` when it's not used in the middleware anymore.
// https://github.com/iExecBlockchainComputing/iexec-commons-poco/blob/819cd008/generateContractWrappers#L7
interface IexecInterface is
    IexecAccessorsABILegacy,
    IexecCategoryManager,
    IexecConfiguration,
    IexecConfigurationExtra,
    IexecEscrow,
    IexecEscrowEvents,
    IexecOrderManagement,
    IexecPoco1,
    IexecPoco2,
    IexecPocoAccessors,
    IexecRelay,
    IexecTokenSpender,
    IOwnable
{}
