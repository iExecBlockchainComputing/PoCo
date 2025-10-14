// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../RegistryEntry.sol";

/**
 * @dev Referenced in the SDK with the current path `contracts/registries/apps/AppRegistry.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
contract App is RegistryEntry {
    /**
     * Members
     */
    string public m_appName;
    string public m_appType;
    bytes public m_appMultiaddr;
    bytes32 public m_appChecksum;
    bytes public m_appMREnclave;

    /**
     * Constructor
     */
    function initialize(
        string memory _appName,
        string memory _appType,
        bytes memory _appMultiaddr,
        bytes32 _appChecksum,
        bytes memory _appMREnclave
    ) public {
        _initialize(msg.sender);
        m_appName = _appName;
        m_appType = _appType;
        m_appMultiaddr = _appMultiaddr;
        m_appChecksum = _appChecksum;
        m_appMREnclave = _appMREnclave;
    }
}
