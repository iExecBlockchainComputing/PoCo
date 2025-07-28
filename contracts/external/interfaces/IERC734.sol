// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

/**
 * @notice The IERC734 interface of onchain-id requires a static version of solidity:
 * https://github.com/onchain-id/solidity/blob/2.2.0/contracts/interface/IERC734.sol
 * Pragma of the interface is updated here to maintain consistency accross the project.
 * @dev Relevant part of ERC734 interface (Key Holder) standard as defined in the EIP.
 */
interface IERC734 {
    /**
     * @dev Returns TRUE if a key is present and has the given purpose. If the key is not
     * present or does not have the given purpose it returns FALSE.
     */
    function keyHasPurpose(bytes32 key, uint256 purpose) external view returns (bool exists);
}
