// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {IexecERC20Common} from "./IexecERC20Common.sol";

interface IexecERC20 is IexecERC20Common {

    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function increaseAllowance(address, uint256) external returns (bool);
    function decreaseAllowance(address, uint256) external returns (bool);
    function approveAndCall(address, uint256, bytes calldata) external returns (bool);
}
