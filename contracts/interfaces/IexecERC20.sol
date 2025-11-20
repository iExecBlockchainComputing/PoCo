// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface IexecERC20 {
    // ═══════════════════════════════════════════════════════════════════════════
    // ESCROW & TRANSFER ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Wrong token address
     * @param provided Provided token address
     * @param expected Expected token address
     */
    error WrongToken(address provided, address expected);

    /**
     * @notice Token operation failed
     */
    error OperationFailed();

    /**
     * @notice Unsupported token operation
     */
    error UnsupportedOperation();

    /**
     * @notice Fallback function disabled
     */
    error FallbackDisabled();

    /**
     * @notice Caller must be the requester
     * @param caller Address of the caller
     * @param requester Address of the requester
     */
    error CallerMustBeRequester(address caller, address requester);

    /**
     * @notice ERC20 transferFrom failed
     * @param from Source address
     * @param to Destination address
     * @param amount Amount to transfer
     */
    error TransferFromFailed(address from, address to, uint256 amount);

    /**
     * @notice Array length mismatch between amounts and targets
     * @param amountsLength Length of amounts array
     * @param targetsLength Length of targets array
     */
    error InvalidArrayLength(uint256 amountsLength, uint256 targetsLength);

    /**
     * @notice Native token transfer failed
     * @param to Recipient address
     * @param amount Amount attempted to transfer
     */
    error NativeTransferFailed(address to, uint256 amount);

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
