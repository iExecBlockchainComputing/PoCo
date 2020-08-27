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

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../../libs/IexecLibOrders_v5.sol";


interface IexecEscrowTokenSwap
{
	receive() external payable;
	fallback() external payable;

	function UniswapV2Router           ()        external view returns (IUniswapV2Router02);
	function estimateDepositEthSent    (uint256) external view returns (uint256);
	function estimateDepositTokenWanted(uint256) external view returns (uint256);
	function estimateWithdrawTokenSent (uint256) external view returns (uint256);
	function estimateWithdrawEthWanted (uint256) external view returns (uint256);

	function depositEth       (                         ) external payable;
	function depositEthFor    (                  address) external payable;
	function safeDepositEth   (         uint256         ) external payable;
	function safeDepositEthFor(         uint256, address) external payable;
	function requestToken     (uint256                  ) external payable;
	function requestTokenFor  (uint256,          address) external payable;
	function withdrawEth      (uint256                  ) external;
	function withdrawEthTo    (uint256,          address) external;
	function safeWithdrawEth  (uint256, uint256         ) external;
	function safeWithdrawEthTo(uint256, uint256, address) external;

	function matchOrdersWithEth(
		IexecLibOrders_v5.AppOrder        memory,
		IexecLibOrders_v5.DatasetOrder    memory,
		IexecLibOrders_v5.WorkerpoolOrder memory,
		IexecLibOrders_v5.RequestOrder    memory)
	external payable returns (bytes32);
}
