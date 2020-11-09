// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
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

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Snapshot.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./IERC20KYC.sol";


contract ERC20KYC is IERC20KYC, ERC20Snapshot, AccessControl
{
    bytes32 public constant KYC_ADMIN_ROLE  = keccak256("KYC_ADMIN_ROLE");
    bytes32 public constant KYC_MEMBER_ROLE = keccak256("KYC_MEMBER_ROLE");

    modifier onlyRole(bytes32 role, address member, string memory message)
    {
        require(hasRole(role, member), message);
        _;
    }

    IERC20  public immutable underlyingToken;
    uint256 public immutable softCap;
    bool    public softCapReached;
    uint256 public minDeposit;

    event MinDepositChanged(uint256 oldMinDeposit, uint256 newMinDeposit);
    event SoftCapReached();

    constructor(address token, string memory name, string memory symbol, uint256 softcap, address[] memory kycadmins)
    public ERC20(name, symbol)
    {
        // configure token
        underlyingToken = IERC20(token);
        _setupDecimals(ERC20(token).decimals());
        softCap = softcap;
        // configure roles
        _setRoleAdmin(KYC_MEMBER_ROLE, KYC_ADMIN_ROLE);
        // grant roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        for (uint256 i = 0; i < kycadmins.length; ++i)
        {
            _setupRole(KYC_ADMIN_ROLE, kycadmins[i]);
        }
    }

    function setMinDeposit(uint256 amount)
    external override
    onlyRole(DEFAULT_ADMIN_ROLE, _msgSender(), "restricted-to-admin")
    {
        emit MinDepositChanged(minDeposit, amount);
        minDeposit = amount;
    }

    /*************************************************************************
     *                              Public view                              *
     *************************************************************************/
    function isKYC(address account)
    public view override returns (bool)
    {
        return hasRole(KYC_MEMBER_ROLE, account);
    }

    function grantKYC(address[] calldata accounts)
    external override
    {
        for (uint256 i = 0; i < accounts.length; ++i)
        {
            grantRole(KYC_MEMBER_ROLE, accounts[i]);
        }
    }

    function revokeKYC(address[] calldata accounts)
    external override
    {
        for (uint256 i = 0; i < accounts.length; ++i)
        {
            revokeRole(KYC_MEMBER_ROLE, accounts[i]);
        }
    }

    /*************************************************************************
     *                       Escrow - public interface                       *
     *************************************************************************/
    function deposit(uint256 amount)
    external override
    {
        _deposit(_msgSender(), amount);
        _mint(_msgSender(), amount);
    }

    function withdraw(uint256 amount)
    external override
    {
        _burn(_msgSender(), amount);
        _withdraw(_msgSender(), amount);
    }

    function recover()
    external override
    onlyRole(DEFAULT_ADMIN_ROLE, _msgSender(), "only-admin")
    {
        _mint(_msgSender(), SafeMath.sub(underlyingToken.balanceOf(address(this)), totalSupply()));
    }

    /*************************************************************************
     *                ERC677 - One-transaction ERC20 deposits                *
     *************************************************************************/
    function receiveApproval(address sender, uint256 amount, address token, bytes calldata)
    external override returns (bool)
    {
        require(token == address(underlyingToken), "wrong-token");
        _deposit(sender, amount);
        _mint(sender, amount);
        return true;
    }

    function approveAndCall(address spender, uint256 amount, bytes calldata extraData)
    external override returns (bool)
    {
        approve(spender, amount);
        require(IERC677Receiver(spender).receiveApproval(_msgSender(), amount, address(this), extraData), "approval-refused-by-receiver");
        return true;
    }

    function onTokenTransfer(address sender, uint256 amount, bytes calldata)
    external override returns (bool)
    {
        require(_msgSender() == address(underlyingToken), "wrong-sender");
        _mint(sender, amount);
        return true;
    }

    function transferAndCall(address receiver, uint256 amount, bytes calldata data)
    external override returns (bool)
    {
        transfer(receiver, amount);
        require(IERC677Receiver(receiver).onTokenTransfer(_msgSender(), amount, data), "transfer-refused-by-receiver");
        return true;
    }

    /*************************************************************************
     *                  ERC1404 - KYC transfer restriction                   *
     *************************************************************************/
    uint8 internal constant _RESTRICTION_OK               = uint8(0);
    uint8 internal constant _RESTRICTION_MISSING_KYC_FROM = uint8(0x01);
    uint8 internal constant _RESTRICTION_MISSING_KYC_TO   = uint8(0x02);

    function detectTransferRestriction(address from, address to, uint256)
    public view override returns (uint8)
    {
        // Allow non kyc to withdraw
        // if (to == address(0)) return _RESTRICTION_OK;

        // sender must be whitelisted or mint
        if (from != address(0) && !isKYC(from))
        {
            return _RESTRICTION_MISSING_KYC_FROM;
        }
        // receiver must be whitelisted or burn
        if (to != address(0) && !isKYC(to))
        {
            return _RESTRICTION_MISSING_KYC_TO;
        }
        return _RESTRICTION_OK;
    }

    function messageForTransferRestriction(uint8 restrictionCode)
    public view override returns (string memory)
    {
        if (restrictionCode == _RESTRICTION_MISSING_KYC_FROM)
        {
            return "Sender is missing KYC";
        }
        if (restrictionCode == _RESTRICTION_MISSING_KYC_TO)
        {
            return "Receiver is missing KYC";
        }
        revert("invalid-restriction-code");
    }

    /*************************************************************************
     *                      Escrow - internal functions                      *
     *************************************************************************/
    function _deposit(address from, uint256 amount)
    internal
    {
        require(amount > minDeposit, "deposit-too-small");
        require(underlyingToken.transferFrom(from, address(this), amount), "failed-transferFrom");
    }

    function _withdraw(address to, uint256 amount)
    internal
    {
        require(underlyingToken.transfer(to, amount), "failed-transfer");
    }

    /*************************************************************************
     *                 ERC20 - alter behaviour to enable KYC                 *
     *************************************************************************/
    // Only allow transfer between KYC members
    function _beforeTokenTransfer(address from, address to, uint256 amount)
    internal override
    {
        uint8 restrictionCode = detectTransferRestriction(from, to, amount);
        if (restrictionCode != _RESTRICTION_OK)
        {
            revert(messageForTransferRestriction(restrictionCode));
        }
        super._beforeTokenTransfer(from, to, amount);
    }

    // Check softcap
    function _mint(address account, uint256 amount)
    internal override
    {
        super._mint(account, amount);
        if (!softCapReached && totalSupply() >= softCap)
        {
            softCapReached = true;
            emit SoftCapReached();
        }
    }

    /*************************************************************************
     *                             ERC20Snapshot                             *
     *************************************************************************/
    function snapshot()
    external
    onlyRole(DEFAULT_ADMIN_ROLE, _msgSender(), "restricted-to-admin")
    returns (uint256)
    {
        return _snapshot();
    }
}
