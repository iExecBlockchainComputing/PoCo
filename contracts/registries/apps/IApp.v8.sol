// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;
interface IApp {
    function owner() external view returns (address);
    function m_appName() external view returns (string memory);
    function m_appType() external view returns (string memory);
    function m_appMultiaddr() external view returns (bytes memory);
    function m_appChecksum() external view returns (bytes32);
    function m_appMREnclave() external view returns (bytes memory);
}
