// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;

import "../libs/PocoStorageLib.sol";
import "../interfaces/IOwnable.sol";

// TODO use LibDiamond.contractOwner() when migrating all contracts to v8.

/**
 * @title Base contract of all Facet contracts.
 * @dev Every facet must inherit from this contract.
 */
abstract contract FacetBase {
    // Poco - Constants
    uint256 public constant CONTRIBUTION_DEADLINE_RATIO = 7;
    uint256 public constant REVEAL_DEADLINE_RATIO = 2;
    uint256 public constant FINAL_DEADLINE_RATIO = 10;
    uint256 public constant WORKERPOOL_STAKE_RATIO = 30;
    uint256 public constant KITTY_RATIO = 10;
    uint256 public constant KITTY_MIN = 1e9; // ADJUSTEMENT VARIABLE

    // Seized funds of workerpools that do not honor their deals are sent
    // out to this kitty address.
    // It is determined with address(uint256(keccak256(bytes('iExecKitty'))) - 1).
    address public constant KITTY_ADDRESS = 0x99c2268479b93fDe36232351229815DF80837e23;

    // Used with ERC-734 Key Manager identity contract for authorization management.
    uint256 public constant GROUPMEMBER_PURPOSE = 4;

    modifier onlyOwner() {
        require(_msgSender() == owner(), "Ownable: caller is not the owner");
        _;
    }

    function owner() public view returns (address) {
        return IOwnable(address(this)).owner();
    }

    function _msgSender() internal view returns (address) {
        return msg.sender;
    }
}
