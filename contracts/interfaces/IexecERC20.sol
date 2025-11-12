// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface IexecERC20 {
    // ERC20 standard events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    // iExec specific events
    event Reward(address owner, uint256 amount, bytes32 ref);
    event Seize(address owner, uint256 amount, bytes32 ref);
    event Lock(address owner, uint256 amount);
    event Unlock(address owner, uint256 amount);

    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function increaseAllowance(address, uint256) external returns (bool);
    function decreaseAllowance(address, uint256) external returns (bool);
    function approveAndCall(address, uint256, bytes calldata) external returns (bool);
}
