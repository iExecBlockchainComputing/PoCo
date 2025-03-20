// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.6.0 <0.9.0;

abstract contract OwnableDiamondStore {
    function owner() public view returns (address) {
        return IOwnable(address(this)).owner();
    }

    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    function _msgSender() internal view returns (address payable) {
        return payable(msg.sender);
    }
}

interface IOwnable {
    function owner() external view returns (address);
}
