// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {PocoStorageLib} from "./PocoStorageLib.sol";

/**
 * @title The sRLC ledger.
 * @notice sRLC ("Staked RLC") is the internal token of the PoCo protocol. It is
 * not a standalone contract: its total supply, balances and allowances live in
 * the PoCo storage. This library is the single owner of every write to them.
 * @dev The events are declared here rather than taken from {IexecEscrowEvents}
 * because solc 0.8.21 cannot compile `emit Other.Event(...)`.
 */
library StakedRlcLib {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * Transfer value from a spender account to a receiver account.
     * @notice
     * This is the single implementation of an sRLC balance move. It backs both
     * the escrow operations of {EscrowLib} and the ERC-20 entry points of
     * {IexecEscrowFacet}.
     * A self-transfer is a no-op on the balances and is not rejected.
     *
     * @param from The address of the spender account.
     * @param to The address of the receiver account.
     * @param value The value to transfer.
     */
    function transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "ERC20: Transfer from empty address");
        require(to != address(0), "ERC20: Transfer to empty address");
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        uint256 fromBalance = $.m_balances[from];
        require(value <= fromBalance, "ERC20: Transfer amount exceeds balance");
        // This block is guaranteed to not underflow because we check the from balance
        // and guaranteed to not overflow because the total supply is capped and there
        // is no minting involved.
        unchecked {
            $.m_balances[from] = fromBalance - value;
            $.m_balances[to] += value;
        }
        emit Transfer(from, to, value);
    }

    /**
     * Create sRLC and credit it to an account.
     * @param account The account to credit.
     * @param amount The amount to create.
     */
    function mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_totalSupply = $.m_totalSupply + amount;
        $.m_balances[account] = $.m_balances[account] + amount;
        emit Transfer(address(0), account, amount);
    }

    /**
     * Destroy sRLC held by an account.
     * @param account The account to debit.
     * @param amount The amount to destroy.
     */
    function burn(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_totalSupply = $.m_totalSupply - amount;
        $.m_balances[account] = $.m_balances[account] - amount;
        emit Transfer(account, address(0), amount);
    }

    /**
     * Set the allowance of a spender over an owner's sRLC.
     * @param owner The account granting the allowance.
     * @param spender The account receiving the allowance.
     * @param amount The allowed amount.
     */
    function approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}
