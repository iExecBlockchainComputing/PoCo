// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
import {FacetBase} from "./FacetBase.sol";
import {IexecERC20Common} from "../interfaces/IexecERC20Common.sol";

contract IexecERC20Core is IexecERC20Common, FacetBase {
    function _transferUnchecked(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_balances[sender] = $.m_balances[sender] - amount;
        $.m_balances[recipient] = $.m_balances[recipient] - amount;
        emit Transfer(sender, recipient, amount);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        _transferUnchecked(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_totalSupply = $.m_totalSupply + amount;
        $.m_balances[account] = $.m_balances[account] + amount;
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_totalSupply = $.m_totalSupply - amount;
        $.m_balances[account] = $.m_balances[account] - amount;
        emit Transfer(account, address(0), amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}
