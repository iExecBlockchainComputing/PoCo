// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.6.0 <0.9.0;

abstract contract OwnableDiamondStore {
    // Add storage slot padding for now to avoid updating the few tests using
    // hardcoded storage slots.
    // slither-disable-start constable-states
    // [0] `Ownable._owner` has been removed
    bytes32 private STORAGE_SLOT_PADDING_0;
    // [1-4] `ERC1538Store.m_funcs` has been removed
    bytes32 private STORAGE_SLOT_PADDING_1;
    bytes32 private STORAGE_SLOT_PADDING_2;
    bytes32 private STORAGE_SLOT_PADDING_3;
    bytes32 private STORAGE_SLOT_PADDING_4;
    // slither-disable-end constable-states

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
