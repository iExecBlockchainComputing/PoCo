// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;

import "../libs/LibPocoStorage.sol";
import "../interfaces/IOwnable.sol";

// Functions that were declared in ERC1538Store are re-declared here.
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
