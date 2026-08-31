// SPDX-FileCopyrightText: 2026 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

/**
 * @title Escrow accounting events.
 * @dev Emitted when funds of an account are frozen, released, rewarded or seized.
 * These are not ERC-20 events: they are emitted by the PoCo facets that settle
 * deals, never by the ERC-20 entry points.
 */
interface IexecEscrowEvents {
    event Lock(address owner, uint256 amount);
    event Unlock(address owner, uint256 amount);
    event Reward(address owner, uint256 amount, bytes32 ref);
    event Seize(address owner, uint256 amount, bytes32 ref);
}
