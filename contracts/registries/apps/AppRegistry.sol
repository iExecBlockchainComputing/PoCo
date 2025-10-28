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
        // TEMPORARY MIGRATION FIX: Catch Create2 custom error and throw string error for backward compatibility
        // TODO: Remove this in the next major version
        try
            this.internal_mintCreate(
                _appOwner,
                encodeInitializer(_appName, _appType, _appMultiaddr, _appChecksum, _appMREnclave)
            )
        returns (address entry) {
            return App(entry);
        } catch {
            revert("Create2: Failed on deploy");
        }
    }

    function internal_mintCreate(address _appOwner, bytes memory _args) external returns (address) {
        return _mintCreate(_appOwner, _args);
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
