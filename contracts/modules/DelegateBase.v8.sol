// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC5313} from "@openzeppelin/contracts-v5/interfaces/IERC5313.sol";
import {Store} from "../Store.v8.sol";

// Functions that were declared in ERC1538Store are re-declared here.
// TODO clean this (use LibDiamond)
//      - All calls to `owner()` should use `LibDiamond.contractOwner()`.
// TODO rename this contract to `FacetBase`.

/**
 * @title Base contract of all Delegate contracts.
 * @dev Every module must inherit from this contract.
 */
abstract contract DelegateBase is Store {
    modifier onlyOwner() {
        require(_msgSender() == owner(), "Ownable: caller is not the owner");
        _;
    }

    function owner() public view returns (address) {
        // Make an external call to delegatecall the OwnershipFacet.
        return IERC5313(address(this)).owner();
    }

    function _msgSender() internal view returns (address ) {
        return msg.sender;
    }
}
