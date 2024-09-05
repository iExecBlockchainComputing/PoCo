// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-v5/interfaces/IERC1271.sol";

contract ERC1271Mock is IERC1271 {
    function isValidSignature(
        bytes32, // message hash
        bytes calldata signature
    ) external pure override returns (bytes4 magicValue) {
        if (bytes32(signature) == keccak256("valid-signature")) {
            return magicValue = IERC1271.isValidSignature.selector;
        } else if (bytes32(signature) == keccak256("invalid-signature")) {
            return magicValue = bytes4(0);
        }
        revert("ERC1271Mock: invalid signature");
    }
}
