// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-v5/interfaces/IERC1271.sol";

contract ERC1271Mock is IERC1271 {
    bool public shouldValidateSignature;

    function setShouldValidateSignature(bool value) external {
        shouldValidateSignature = value;
    }

    function isValidSignature(
        bytes32,
        bytes memory
    ) external view override returns (bytes4 magicValue) {
        if (shouldValidateSignature) {
            magicValue = IERC1271.isValidSignature.selector;
        }
    }
}
