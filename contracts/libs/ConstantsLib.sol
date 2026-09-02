// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

/**
 * @title The protocol constants of PoCo.
 * @notice The single declaration of every protocol constant. {FacetBase} aliases
 * them so the facets keep reading them under their bare names.
 * @dev They live in a library, not in a base contract, because a library cannot
 * inherit and a contract constant is not readable from outside its own contract
 * at any visibility. A library constant carries no such restriction, so both the
 * facets and the helper libraries reach the same declaration.
 */
library ConstantsLib {
    // Deadline ratios, expressed as multiples of the category time frame.
    uint256 internal constant CONTRIBUTION_DEADLINE_RATIO = 7;
    uint256 internal constant REVEAL_DEADLINE_RATIO = 2;
    uint256 internal constant FINAL_DEADLINE_RATIO = 10;

    // Share of the deal price a workerpool must stake, as a percentage.
    uint256 internal constant WORKERPOOL_STAKE_RATIO = 30;

    // Share of the kitty released to a workerpool on each reward, as a
    // percentage, and the floor below which the whole kitty is released.
    uint256 internal constant KITTY_RATIO = 10;
    uint256 internal constant KITTY_MIN = 1e9; // ADJUSTEMENT VARIABLE

    // Seized funds of workerpools that do not honor their deals are sent
    // out to this kitty address.
    // It is determined with address(uint256(keccak256(bytes('iExecKitty'))) - 1).
    address internal constant KITTY_ADDRESS = 0x99c2268479b93fDe36232351229815DF80837e23;

    // Used with ERC-734 Key Manager identity contract for authorization management.
    uint256 internal constant GROUPMEMBER_PURPOSE = 4;
}
