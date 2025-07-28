// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;

import "../libs/LibPocoStorage.sol";
import "./interfaces/IOwnable.sol";

// Functions that were declared in ERC1538Store are re-declared here.
// TODO clean this (use LibDiamond)
//      - All calls to `owner()` should use `LibDiamond.contractOwner()`.

/**
 * @title Base contract of all Facet contracts using diamond storage.
 * @dev Every module must inherit from this contract.
 * This version uses LibPocoStorage library instead of inheriting from Store abstract contract
 * to support ERC-2535 diamond proxy architecture.
 */
abstract contract FacetBase {
    modifier onlyOwner() {
        require(_msgSender() == owner(), "Ownable: caller is not the owner");
        _;
    }

    function owner() public view virtual returns (address) {
        return IOwnable(address(this)).owner();
    }

    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    // === Storage Access Helper Functions ===
    // These provide backward compatibility for facets that were using Store directly

    /**
     * @dev Get the PocoStorage struct for direct access when needed.
     * @return The storage pointer to PocoStorage struct.
     */
    function getPocoStorage() internal pure returns (LibPocoStorage.PocoStorage storage) {
        return LibPocoStorage.getPocoStorage();
    }
}
