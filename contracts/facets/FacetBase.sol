// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
import {IERC5313} from "@openzeppelin/contracts-v5/interfaces/IERC5313.sol";

// TODO use LibDiamond.contractOwner() when migrating all contracts to v8.

/**
 * @title Base contract of all Facet contracts.
 * @dev Every facet must inherit from this contract.
 */
abstract contract FacetBase {
    // Poco - Constants
    uint256 internal constant CONTRIBUTION_DEADLINE_RATIO = 7;
    uint256 internal constant REVEAL_DEADLINE_RATIO = 2;
    uint256 internal constant FINAL_DEADLINE_RATIO = 10;
    uint256 internal constant WORKERPOOL_STAKE_RATIO = 30;
    uint256 internal constant KITTY_RATIO = 10;
    uint256 internal constant KITTY_MIN = 1e9; // ADJUSTEMENT VARIABLE

    // Seized funds of workerpools that do not honor their deals are sent
    // out to this kitty address.
    // It is determined with address(uint256(keccak256(bytes('iExecKitty'))) - 1).
    address internal constant KITTY_ADDRESS = 0x99c2268479b93fDe36232351229815DF80837e23;

    // Used with ERC-734 Key Manager identity contract for authorization management.
    uint256 internal constant GROUPMEMBER_PURPOSE = 4;

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
