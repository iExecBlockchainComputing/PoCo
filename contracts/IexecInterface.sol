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
import {IexecPoco1Errors} from "./interfaces/IexecPoco1Errors.sol";
import {IexecPoco2} from "./interfaces/IexecPoco2.sol";
import {IexecPocoAccessors} from "./interfaces/IexecPocoAccessors.sol";
import {IexecRelay} from "./interfaces/IexecRelay.sol";
import {IexecTokenSpender} from "./interfaces/IexecTokenSpender.sol";
import {IOwnable} from "./interfaces/IOwnable.sol";

// TODO see if Diamond interfaces should be added here ??
// IDiamond, IDiamondLoupe, IDiamondCut, IERC165, IERC173 (ownership)

/**
 * A global interface that aggregates all the interfaces needed to interact with
 * the PoCo contracts.
 * @dev Referenced in the SDK with the path `contracts/IexecInterface.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
// TODO Remove the interface `IexecAccessorsABILegacy` when it's not used in the middleware anymore.
// https://github.com/iExecBlockchainComputing/iexec-commons-poco/blob/819cd008/generateContractWrappers#L7
// TODO Add the interfaces `IexecPocoBoost` and `IexecPocoBoostAccessors` once the Boost facets
// are deployed on every network. They are not deployed on Arbitrum mainnet nor on Arbitrum
// Sepolia today, so aggregating them here would make the SDK advertise functions that revert.
interface IexecInterface is
    IexecAccessorsABILegacy,
    IexecCategoryManager,
    IexecConfiguration,
    IexecConfigurationExtra,
    IexecEscrow,
    IexecEscrowEvents,
    IexecOrderManagement,
    IexecPoco1,
    IexecPoco1Errors,
    IexecPoco2,
    IexecPocoAccessors,
    IexecRelay,
    IexecTokenSpender,
    IOwnable
{}
