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
import {IexecPoco1Errors} from "./interfaces/IexecPoco1Errors.sol";
import {IexecPoco2} from "./interfaces/IexecPoco2.sol";
import {IexecPocoAccessors} from "./interfaces/IexecPocoAccessors.sol";
import {IexecPocoDepositAndMatch} from "./interfaces/IexecPocoDepositAndMatchToken.sol";
import {IexecRelay} from "./interfaces/IexecRelay.sol";
import {IexecTokenSpender} from "./interfaces/IexecTokenSpender.sol";
import {IOwnable} from "./interfaces/IOwnable.sol";

// TODO see if Diamond interfaces should be added here ??
// IDiamond, IDiamondLoupe, IDiamondCut, IERC165, IERC173 (ownership)

/**
 * A global interface that aggregates all the interfaces needed to interact with
 * the PoCo contracts in token mode.
 * @dev Referenced in the SDK with the current path `contracts/IexecInterfaceToken.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
// TODO Remove interface `IexecAccessorsABILegacy` when it's not used in the middleware anymore.
// https://github.com/iExecBlockchainComputing/iexec-commons-poco/blob/819cd008/generateContractWrappers#L7
interface IexecInterfaceToken is
    IexecAccessorsABILegacy,
    IexecCategoryManager,
    IexecConfiguration,
    IexecConfigurationExtra,
    IexecERC20,
    IexecERC20Common,
    IexecEscrowToken,
    IexecOrderManagement,
    IexecPoco1,
    IexecPoco1Errors,
    IexecPoco2,
    IexecPocoAccessors,
    IexecPocoDepositAndMatch,
    IexecRelay,
    IexecTokenSpender,
    IOwnable
{}
