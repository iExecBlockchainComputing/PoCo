// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {FacetBase} from "./FacetBase.sol";
import {IexecERC20} from "../interfaces/IexecERC20.sol";
import {IexecTokenSpender} from "../interfaces/IexecTokenSpender.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";

// TODO: Merge this abstract contract with IexecEscrowTokenFacet
// once IexecEscrowNativeFacet is deprecated and removed in a future major version.
abstract contract IexecERC20Base is IexecERC20, FacetBase {
    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function approve(address spender, uint256 value) external override returns (bool) {
        _approve(_msgSender(), spender, value);
        return true;
    }

    function approveAndCall(
        address spender,
        uint256 value,
        bytes calldata extraData
    ) external override returns (bool) {
        _approve(_msgSender(), spender, value);
        require(
            IexecTokenSpender(spender).receiveApproval(
                _msgSender(),
                value,
                address(this),
                extraData
            ),
            "approval-refused"
        );
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        _transfer(sender, recipient, amount);
        // TEMPORARY MIGRATION FIX: Check allowance to prevent underflow and revert without reason for backward compatibility
        // TODO: Remove this in the next major version
        uint256 currentAllowance = $.m_allowances[sender][_msgSender()];
        if (currentAllowance < amount) {
            revert();
        }
        _approve(sender, _msgSender(), currentAllowance - amount);
        return true;
    }

    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) external override returns (bool) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        _approve(_msgSender(), spender, $.m_allowances[_msgSender()][spender] + addedValue);
        return true;
    }

    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) external override returns (bool) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        // TEMPORARY MIGRATION FIX: Check allowance to prevent underflow and revert without reason for backward compatibility
        // TODO: Remove this in the next major version
        uint256 currentAllowance = $.m_allowances[_msgSender()][spender];
        if (currentAllowance < subtractedValue) {
            revert();
        }
        _approve(_msgSender(), spender, currentAllowance - subtractedValue);
        return true;
    }

    function _transferUnchecked(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        uint256 senderBalance = $.m_balances[sender];
        // TEMPORARY MIGRATION FIX: Check balance to prevent underflow and revert without reason for backward compatibility
        // TODO: Remove this in the next major version
        if (senderBalance < amount) {
            revert();
        }
        $.m_balances[sender] = senderBalance - amount;
        $.m_balances[recipient] = $.m_balances[recipient] + amount;
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
        uint256 accountBalance = $.m_balances[account];
        // TEMPORARY MIGRATION FIX: Check balance to prevent underflow and revert without reason for backward compatibility
        // TODO: Remove this in the next major version
        if (accountBalance < amount) {
            revert();
        }
        $.m_totalSupply = $.m_totalSupply - amount;
        $.m_balances[account] = accountBalance - amount;
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
