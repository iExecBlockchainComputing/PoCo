// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../RegistryEntry.sol";

/**
 * @dev Referenced in the SDK with the current path `contracts/registries/datasets/Dataset.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
contract Dataset is RegistryEntry {
    /**
     * Members
     */
    string public m_datasetName;
    bytes public m_datasetMultiaddr;
    bytes32 public m_datasetChecksum;

    /**
     * Constructor
     */
    function initialize(
        string memory _datasetName,
        bytes memory _datasetMultiaddr,
        bytes32 _datasetChecksum
    ) public {
        _initialize(msg.sender);
        m_datasetName = _datasetName;
        m_datasetMultiaddr = _datasetMultiaddr;
        m_datasetChecksum = _datasetChecksum;
    }
}
