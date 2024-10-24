// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC734} from "../../external/interfaces/IERC734.sol";

/**
 * @notice This contract is for testing purposes only.
 */
contract ERC734Mock is IERC734 {
    mapping(uint256 purpose => mapping(bytes32 key => bool)) private _keyHasPurpose;

    function keyHasPurpose(bytes32 key, uint256 purpose) external view returns (bool) {
        return _keyHasPurpose[purpose][key];
    }

    /**
     * @notice Allows to easily configure from tests the behaviour of this contract.
     */
    function setKeyHasPurpose(bytes32 key, uint256 purpose) external {
        _keyHasPurpose[purpose][key] = true;
    }
}
