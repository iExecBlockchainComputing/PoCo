// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.6.0 <0.9.0;

abstract contract OwnableDiamondStore {
    // Add storage slot padding for now to avoid updating the few tests using
    // hardcoded storage slots.
    // [0]   `Ownable._owner` has been removed
    // [1-4] `ERC1538Store.m_funcs` has been removed
    // slither-disable-next-line constable-states
    bytes32[5] private STORAGE_SLOT_PADDING;

    function owner() internal view returns (address) {
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
