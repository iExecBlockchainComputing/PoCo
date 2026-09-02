// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;
import {PocoStorageLib} from "./PocoStorageLib.sol";
import {StakedRlcLib} from "./StakedRlcLib.sol";

/**
 * @title Manage (lock/unlock/reward/seize) user funds.
 * @notice The escrow layers on top of the sRLC ledger: it owns `m_frozens` and
 * defers every balance move to {StakedRlcLib}.
 * @dev The events are declared here rather than taken from {IexecEscrowEvents}
 * because solc 0.8.21 cannot compile `emit Other.Event(...)`.
 */
library EscrowLib {
    event Reward(address owner, uint256 amount, bytes32 ref);
    event Seize(address owner, uint256 amount, bytes32 ref);
    event Lock(address owner, uint256 amount);
    event Unlock(address owner, uint256 amount);

    /**
     * Lock some value of an account.
     * @param account The account where the value should be locked.
     * @param value The value to lock.
     */
    function lock(address account, uint256 value) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        StakedRlcLib.transfer(account, address(this), value);
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
        StakedRlcLib.transfer(address(this), account, value);
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
        StakedRlcLib.transfer(address(this), account, value);
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
     * Reward an account and immediately lock the rewarded value.
     * @notice Equivalent to `reward(account, value, ref)` followed by
     * `lock(account, value)`, without the two transfers that would move the value
     * from the proxy to the account and straight back to the proxy.
     * @param account The account to reward and lock.
     * @param value The value to reward then lock.
     * @param ref A reference of the reward context.
     */
    function rewardAndLock(address account, uint256 value, bytes32 ref) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_frozens[account] += value;
        emit Reward(account, value, ref);
        emit Lock(account, value);
    }
}
