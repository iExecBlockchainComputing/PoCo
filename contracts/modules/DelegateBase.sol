// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;

import "../Store.sol";

abstract contract DelegateBase is Store {

    modifier onlyOwner() {
        require(_msgSender() == owner(), "Ownable: caller is not the owner");
        _;
    }

    function owner() public view returns (address) {
        return IOwnable(address(this)).owner();
    }

    function _msgSender() internal view returns (address ) {
        return msg.sender;
    }

}

interface IOwnable {
    function owner() external view returns (address);
}
