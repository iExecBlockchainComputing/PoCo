// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Store} from "../Store.v8.sol";

/**
 * @title Base contract of all Delegate contracts.
 * @dev Every module must inherit from this contract.
 */
// TODO use DiamondLib for ownership management.
abstract contract DelegateBase is Store {
    modifier onlyOwner() {
        require(_msgSender() == owner(), "Ownable: caller is not the owner");
        _;
    }

    function owner() public view returns (address) {
        // Make an external call to delegatecall the OwnershipFacet.
        return IOwnable(address(this)).owner();
    }

    function _msgSender() internal view returns (address ) {
        return msg.sender;
    }
}

interface IOwnable {
    function owner() external view returns (address);
}

