// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2023 IEXEC BLOCKCHAIN TECH                                       *
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

pragma solidity ^0.8.0;

import {DelegateBase} from "../DelegateBase.v8.sol";

/**
 * @title Manage (lock/unlock/reward/seize) user funds.
 */
contract IexecEscrow is DelegateBase {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Lock(address owner, uint256 amount);
    event Unlock(address owner, uint256 amount);
    event Reward(address owner, uint256 amount, bytes32 ref);
    event Seize(address owner, uint256 amount, bytes32 ref);

    /**
     * Lock some value of an account.
     * @param account The account where the value should be locked.
     * @param value The value to lock.
     */
    function lock(address account, uint256 value) internal {
        _transfer(account, address(this), value);
        m_frozens[account] += value;
        emit Lock(account, value);
    }

    /**
     * Unlock some value of an account.
     * @param account The account where the value should be unlocked.
     * @param value The value to unlock.
     */
    function unlock(address account, uint256 value) internal {
        _transfer(address(this), account, value);
        m_frozens[account] -= value;
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
        m_frozens[account] -= value;
        emit Seize(account, value, ref);
    }

    /**
     * Transfer value from a spender account to a receiver account.
     * @param from The address of the spender account.
     * @param to The address of the receiver account.
     * @param value The value to transfer.
     */
    function _transfer(address from, address to, uint256 value) private {
        require(from != address(0), "IexecEscrow: Transfer from empty address");
        require(to != address(0), "IexecEscrow: Transfer to empty address");
        uint256 fromBalance = m_balances[from];
        require(value <= fromBalance, "IexecEscrow: Transfer amount exceeds balance");
        // This block is guaranteed to not underflow because we check the from balance
        // and guaranteed to not overflow because the total supply is capped and there
        // is no minting involved.
        unchecked {
            m_balances[from] = fromBalance - value;
            m_balances[to] += value;
        }
        emit Transfer(from, to, value);
    }
}
