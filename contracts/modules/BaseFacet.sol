// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;

import "../Store.sol";
import "./interfaces/IOwnable.sol";

// Functions that were declared in ERC1538Store are re-declared here.
// TODO clean this (use LibDiamond)
//      - All calls to `owner()` should use `LibDiamond.contractOwner()`.

abstract contract BaseFacet is Store {
    modifier onlyOwner() {
        require(_msgSender() == owner(), "Ownable: caller is not the owner");
        _;
    }

    function owner() public view returns (address) {
        return IOwnable(address(this)).owner();
    }

    function _msgSender() internal view returns (address) {
        return msg.sender;
    }
}
