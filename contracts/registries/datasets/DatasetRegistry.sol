// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../Registry.sol";
import "./Dataset.sol";

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
        // TEMPORARY MIGRATION FIX: Catch Create2 custom error and throw string error for backward compatibility
        // TODO: Remove this in the next major version
        try
            this.internal_mintCreate(
                _datasetOwner,
                encodeInitializer(_datasetName, _datasetMultiaddr, _datasetChecksum)
            )
        returns (address entry) {
            return Dataset(entry);
        } catch {
            revert("Create2: Failed on deploy");
        }
    }

    function internal_mintCreate(
        address _datasetOwner,
        bytes memory _args
    ) external returns (address) {
        return _mintCreate(_datasetOwner, _args);
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
