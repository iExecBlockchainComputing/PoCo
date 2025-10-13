// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;
interface IDataset {
    function owner() external view returns (address);
    function m_datasetName() external view returns (string memory);
    function m_datasetMultiaddr() external view returns (bytes memory);
    function m_datasetChecksum() external view returns (bytes32);
}
