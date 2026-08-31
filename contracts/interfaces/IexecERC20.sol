// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecERC20Events} from "./IexecERC20Events.sol";

interface IexecERC20 is IexecERC20Events {
    // ERC20 standard events
    // `Transfer` is inherited from {IexecERC20Events}.
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function increaseAllowance(address, uint256) external returns (bool);
    function decreaseAllowance(address, uint256) external returns (bool);
    function approveAndCall(address, uint256, bytes calldata) external returns (bool);
}
