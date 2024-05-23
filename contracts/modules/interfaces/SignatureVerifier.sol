// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface SignatureVerifier {
    function toTypedDataHash(bytes32 structHash) external view returns (bytes32);
}
