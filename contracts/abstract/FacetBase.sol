// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {ConstantsLib} from "../libs/ConstantsLib.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
import {IERC5313} from "@openzeppelin/contracts/interfaces/IERC5313.sol";

// TODO use LibDiamond.contractOwner() when migrating all contracts to v8.

/**
 * @title Base contract of all Facet contracts.
 * @dev Every facet must inherit from this contract.
 */
abstract contract FacetBase {
    // Protocol constants, kept reachable under their bare names by the facets
    // that inherit this contract. {ConstantsLib} is the single declaration.
    uint256 internal constant CONTRIBUTION_DEADLINE_RATIO =
        ConstantsLib.CONTRIBUTION_DEADLINE_RATIO;
    uint256 internal constant REVEAL_DEADLINE_RATIO = ConstantsLib.REVEAL_DEADLINE_RATIO;
    uint256 internal constant FINAL_DEADLINE_RATIO = ConstantsLib.FINAL_DEADLINE_RATIO;
    uint256 internal constant WORKERPOOL_STAKE_RATIO = ConstantsLib.WORKERPOOL_STAKE_RATIO;
    uint256 internal constant KITTY_RATIO = ConstantsLib.KITTY_RATIO;
    uint256 internal constant KITTY_MIN = ConstantsLib.KITTY_MIN;
    address internal constant KITTY_ADDRESS = ConstantsLib.KITTY_ADDRESS;
    uint256 internal constant GROUPMEMBER_PURPOSE = ConstantsLib.GROUPMEMBER_PURPOSE;

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
