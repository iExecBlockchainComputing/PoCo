// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Registry} from "../Registry.sol";
import {Dataset} from "./Dataset.sol";

/**
 * @dev Referenced in the SDK with the current path `contracts/registries/datasets/DatasetRegistry.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
contract DatasetRegistry is Registry {
    /**
     * Constructor
     */
    constructor()
        Registry(address(new Dataset()), "iExec Dataset Registry (V5)", "iExecDatasetsV5")
    {}

    /**
     * Dataset creation
     */
    function encodeInitializer(
        string memory _datasetName,
        bytes memory _datasetMultiaddr,
        bytes32 _datasetChecksum
    ) internal pure returns (bytes memory) {
        return
            abi.encodeWithSignature(
                "initialize(string,bytes,bytes32)",
                _datasetName,
                _datasetMultiaddr,
                _datasetChecksum
            );
    }

    function createDataset(
        address _datasetOwner,
        string calldata _datasetName,
        bytes calldata _datasetMultiaddr,
        bytes32 _datasetChecksum
    ) external returns (Dataset) {
        bytes memory initializer = encodeInitializer(
            _datasetName,
            _datasetMultiaddr,
            _datasetChecksum
        );
        address entry = _mintPredict(_datasetOwner, initializer);
        // TEMPORARY MIGRATION FIX: Check if contract already exists to revert without custom error for backward compatibility
        // TODO: Remove this in the next major version
        if (entry.code.length > 0) {
            revert("Create2: Failed on deploy");
        }
        _mintCreate(_datasetOwner, initializer);
        return Dataset(entry);
    }

    function predictDataset(
        address _datasetOwner,
        string calldata _datasetName,
        bytes calldata _datasetMultiaddr,
        bytes32 _datasetChecksum
    ) external view returns (Dataset) {
        return
            Dataset(
                _mintPredict(
                    _datasetOwner,
                    encodeInitializer(_datasetName, _datasetMultiaddr, _datasetChecksum)
                )
            );
    }
}
