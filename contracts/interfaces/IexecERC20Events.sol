// SPDX-FileCopyrightText: 2026 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

/**
 * @title ERC-20 events shared by the ERC-20 surface and the escrow accounting.
 * @dev `Transfer` is emitted from two places: the ERC-20 entry points of the escrow
 * facet and the internal fund movements of the escrow (lock/unlock/reward). Both
 * inherit this interface so the event is declared exactly once.
 * `Approval` stays in {IexecERC20} because only the ERC-20 surface emits it.
 */
interface IexecERC20Events {
    event Transfer(address indexed from, address indexed to, uint256 value);
}
