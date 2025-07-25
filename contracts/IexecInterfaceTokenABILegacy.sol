// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./modules/interfaces/IOwnable.sol";
import "./modules/interfaces/IexecAccessors.sol";
import "./modules/interfaces/IexecAccessorsABILegacy.sol";
import "./modules/interfaces/IexecCategoryManager.sol";
import "./modules/interfaces/IexecERC20.sol";
import "./modules/interfaces/IexecEscrowToken.sol";
import "./modules/interfaces/IexecEscrowTokenSwap.sol";
import "./modules/interfaces/IexecMaintenance.sol";
import "./modules/interfaces/IexecOrderManagement.sol";
import "./modules/interfaces/IexecPoco1.sol";
import "./modules/interfaces/IexecPoco2.sol";
import "./modules/interfaces/IexecRelay.sol";
import "./modules/interfaces/IexecTokenSpender.sol";

interface IexecInterfaceTokenABILegacy is
    IOwnable,
    IexecAccessors,
    IexecAccessorsABILegacy,
    IexecCategoryManager,
    IexecERC20,
    IexecEscrowToken,
    IexecEscrowTokenSwap,
    IexecMaintenance,
    IexecOrderManagement,
    IexecPoco1,
    IexecPoco2,
    IexecRelay,
    IexecTokenSpender
{
    receive() external payable override(IexecEscrowToken, IexecEscrowTokenSwap);
    fallback() external payable override(IexecEscrowToken, IexecEscrowTokenSwap);
}
