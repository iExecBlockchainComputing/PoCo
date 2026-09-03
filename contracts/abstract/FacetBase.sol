// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
import {IERC5313} from "@openzeppelin/contracts/interfaces/IERC5313.sol";

// TODO use LibDiamond.contractOwner() when migrating all contracts to v8.

/**
 * @title Base contract of all Facet contracts.
 * @dev Every facet must inherit from this contract.
 */
abstract contract FacetBase {
    modifier onlyOwner() {
        require(_msgSender() == owner(), "Ownable: caller is not the owner");
        _;
    }

    function owner() internal view returns (address) {
        // TODO use LibDiamond.contractOwner() instead of an external call when migrating all contracts to v8.
        return IERC5313(address(this)).owner();
    }

    function _msgSender() internal view returns (address) {
        return msg.sender;
    }
}
