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

import "@iexec/solidity/contracts/ERC1154/IERC1154.sol";
import "../../libs/IexecLibCore_v5.sol";
import "../../registries/IRegistry.sol";

interface IexecAccessors is IOracle
{
	function name() external view returns (string memory);
	function symbol() external view returns (string memory);
	function decimals() external view returns (uint8);
	function totalSupply() external view returns (uint256);
	function balanceOf(address) external view returns (uint256);
	function frozenOf(address) external view returns (uint256);
	function allowance(address,address) external view returns (uint256);
	function viewAccount(address) external view returns (IexecLibCore_v5.Account memory);
	function token() external view returns (address);
	function viewDeal(bytes32) external view returns (IexecLibCore_v5.Deal memory);
	function viewConsumed(bytes32) external view returns (uint256);
	function viewPresigned(bytes32) external view returns (address);
	function viewTask(bytes32) external view returns (IexecLibCore_v5.Task memory);
	function viewContribution(bytes32,address) external view returns (IexecLibCore_v5.Contribution memory);
	function viewScore(address) external view returns (uint256);
	// function resultFor(bytes32) external view returns (bytes memory); // Already part of IOracle
	function viewCategory(uint256) external view returns (IexecLibCore_v5.Category memory);
	function countCategory() external view returns (uint256);

	function appregistry() external view returns (IRegistry);
	function datasetregistry() external view returns (IRegistry);
	function workerpoolregistry() external view returns (IRegistry);
	function teebroker() external view returns (address);
	function callbackgas() external view returns (uint256);

	function contribution_deadline_ratio() external view returns (uint256);
	function reveal_deadline_ratio() external view returns (uint256);
	function final_deadline_ratio() external view returns (uint256);
	function workerpool_stake_ratio() external view returns (uint256);
	function kitty_ratio() external view returns (uint256);
	function kitty_min() external view returns (uint256);
	function kitty_address() external view returns (address);
	function groupmember_purpose() external view returns (uint256);
	function eip712domain_separator() external view returns (bytes32);
}
