// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
import {IexecERC20Events} from "../interfaces/IexecERC20Events.sol";
import {IexecEscrowEvents} from "../interfaces/IexecEscrowEvents.sol";
import {FacetBase} from "./FacetBase.sol";

/**
 * @title Manage (lock/unlock/reward/seize) user funds.
 */
abstract contract IexecEscrow is FacetBase, IexecERC20Events, IexecEscrowEvents {
    /**
     * Lock some value of an account.
     * @param account The account where the value should be locked.
     * @param value The value to lock.
     */
    function lock(address account, uint256 value) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        _transfer(account, address(this), value);
        $.m_frozens[account] += value;
        emit Lock(account, value);
    }

    /**
     * Unlock some value of an account.
     * @param account The account where the value should be unlocked.
     * @param value The value to unlock.
     */
    function unlock(address account, uint256 value) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        _transfer(address(this), account, value);
        $.m_frozens[account] -= value;
        emit Unlock(account, value);
    }

    /**
     * Reward an account.
     * @param account The account to reward.
     * @param value The reward value.
     * @param ref A reference of the reward context.
     */
    function reward(address account, uint256 value, bytes32 ref) internal {
        _transfer(address(this), account, value);
        emit Reward(account, value, ref);
    }

    /**
     * Seize value on an account.
     * @param account The account to seize.
     * @param value The seize value.
     * @param ref A reference of the seize context.
     */
    function seize(address account, uint256 value, bytes32 ref) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_frozens[account] -= value;
        emit Seize(account, value, ref);
    }

    /**
     * Transfer value from a spender account to a receiver account.
     * @notice
     * This is the single implementation of a balance move over `m_balances`.
     * It backs both the escrow operations of this contract (lock, unlock,
     * reward) and the ERC-20 entry points of the escrow facet.
     *
     * A self-transfer is a no-op on the balances and is not rejected.
     *
     * @param from The address of the spender account.
     * @param to The address of the receiver account.
     * @param value The value to transfer.
     */
    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "IexecEscrow: Transfer from empty address");
        require(to != address(0), "IexecEscrow: Transfer to empty address");
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        uint256 fromBalance = $.m_balances[from];
        require(value <= fromBalance, "IexecEscrow: Transfer amount exceeds balance");
        // This block is guaranteed to not underflow because we check the from balance
        // and guaranteed to not overflow because the total supply is capped and there
        // is no minting involved.
        unchecked {
            $.m_balances[from] = fromBalance - value;
            $.m_balances[to] += value;
        }
        emit Transfer(from, to, value);
    }
}
