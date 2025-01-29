// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

contract Datapool {
    event DatasetAdded(address dataset, uint256 versionId, uint256 datasetCount);
    event DatasetRemoved(address dataset, uint256 versionId, uint256 datasetCount);

    uint256 public versionId;
    mapping(address dataset => uint256 addedVersionId) public addedVersionId;
    address[] public datasets;
    mapping(address dataset => uint256 index) public datasetIndexes;

    constructor() {}

    function datasetCount() external view returns (uint256) {
        return datasets.length;
    }

    function addDataset(address dataset) external {
        versionId++;
        datasets.push(dataset);
        datasetIndexes[dataset] = datasets.length;
        addedVersionId[dataset] = versionId;
        emit DatasetAdded(dataset, versionId, datasets.length);
    }

    function removeDataset(address removedDataset) external {
        versionId++;
        uint256 removedDatasetIndex = datasetIndexes[removedDataset];
        address movingDataset = datasets[datasets.length - 1];
        datasets[removedDatasetIndex] = movingDataset; // move last dataset to removed index slot
        datasetIndexes[movingDataset] = removedDatasetIndex;
        datasets.pop(); // removed already moved dataset
        datasetIndexes[removedDataset] = 0;
        addedVersionId[removedDataset] = 0;
        emit DatasetRemoved(removedDataset, versionId, datasets.length);
    }
}
