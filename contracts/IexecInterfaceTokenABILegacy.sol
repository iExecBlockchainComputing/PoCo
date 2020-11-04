// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

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
import "./modules/interfaces/ENSIntegration.sol";


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
	IexecTokenSpender,
	ENSIntegration
{
	receive()  external override(IexecEscrowToken, IexecEscrowTokenSwap) payable;
	fallback() external override(IexecEscrowToken, IexecEscrowTokenSwap) payable;
}
