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


interface IexecEscrowNative
{
	receive() external payable;
	fallback() external payable;

	function deposit() external payable returns (bool);
	function depositFor(address) external payable returns (bool);
	function depositForArray(uint256[] calldata,address[] calldata) external payable returns (bool);
	function withdraw(uint256) external returns (bool);
	function withdrawTo(uint256,address) external returns (bool);
	function recover() external returns (uint256);
}
