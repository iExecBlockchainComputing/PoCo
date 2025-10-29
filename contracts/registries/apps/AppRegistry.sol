// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../Registry.sol";
import "./App.sol";

/**
 * @dev Referenced in the SDK with the current path `contracts/registries/apps/AppRegistry.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
contract AppRegistry is Registry {
    /**
     * Constructor
     */
    constructor() Registry(address(new App()), "iExec Application Registry (V5)", "iExecAppsV5") {}

    /**
     * App creation
     */
    function encodeInitializer(
        string memory _appName,
        string memory _appType,
        bytes memory _appMultiaddr,
        bytes32 _appChecksum,
        bytes memory _appMREnclave
    ) internal pure returns (bytes memory) {
        return
            abi.encodeWithSignature(
                "initialize(string,string,bytes,bytes32,bytes)",
                _appName,
                _appType,
                _appMultiaddr,
                _appChecksum,
                _appMREnclave
            );
    }

    function createApp(
        address _appOwner,
        string calldata _appName,
        string calldata _appType,
        bytes calldata _appMultiaddr,
        bytes32 _appChecksum,
        bytes calldata _appMREnclave
    ) external returns (App) {
        bytes memory initializer = encodeInitializer(
            _appName,
            _appType,
            _appMultiaddr,
            _appChecksum,
            _appMREnclave
        );
        address entry = _mintPredict(_appOwner, initializer);

        // TEMPORARY MIGRATION FIX: Check if contract already exists to revert without custom error for backward compatibility
        // TODO: Remove this in the next major version
        if (entry.code.length > 0) {
            revert("Create2: Failed on deploy");
        }

        _mintCreate(_appOwner, initializer);
        return App(entry);
    }

    function predictApp(
        address _appOwner,
        string calldata _appName,
        string calldata _appType,
        bytes calldata _appMultiaddr,
        bytes32 _appChecksum,
        bytes calldata _appMREnclave
    ) external view returns (App) {
        return
            App(
                _mintPredict(
                    _appOwner,
                    encodeInitializer(
                        _appName,
                        _appType,
                        _appMultiaddr,
                        _appChecksum,
                        _appMREnclave
                    )
                )
            );
    }
}
