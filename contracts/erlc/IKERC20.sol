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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IERC677.sol";
import "./IERC1404.sol";


interface IKERC20 is IERC20, IERC677, IERC677Receiver, IERC1404
{
    event MinDepositChanged(uint256 oldMinDeposit, uint256 newMinDeposit);
    event SoftCapReached();

    function setMinDeposit(uint256) external;
    function isKYC(address) external view returns (bool);
    function grantKYC(address[] calldata) external;
    function revokeKYC(address[] calldata) external;
    function deposit(uint256) external;
    function withdraw(uint256) external;
    function recover() external;
}
