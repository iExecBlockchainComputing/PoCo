// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface IexecEscrowToken {
    // ERC20 standard events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    // iExec specific events
    event Reward(address owner, uint256 amount, bytes32 ref);
    event Seize(address owner, uint256 amount, bytes32 ref);
    event Lock(address owner, uint256 amount);
    event Unlock(address owner, uint256 amount);

    error UnsupportedOperation(bytes4 selector);
    error OperationFailed();
    error CallerIsNotTheRequester();

    receive() external payable;
    fallback() external payable;
    function deposit(uint256) external returns (bool);
    function depositFor(uint256, address) external returns (bool);
    function depositForArray(uint256[] calldata, address[] calldata) external returns (bool);
    function withdraw(uint256) external returns (bool);
    function withdrawTo(uint256, address) external returns (bool);
    function recover() external returns (uint256);

    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function increaseAllowance(address, uint256) external returns (bool);
    function decreaseAllowance(address, uint256) external returns (bool);
    function approveAndCall(address, uint256, bytes calldata) external returns (bool);
}
