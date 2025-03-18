// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

pragma solidity ^0.8.0;

interface IDataset {
    function m_datasetName() external view returns (string memory);
    function m_datasetMultiaddr() external view returns (bytes memory);
    function m_datasetChecksum() external view returns (bytes32);
}
interface IDatasetRegistry {
    function createDataset(
        address _datasetOwner,
        string calldata _datasetName,
        bytes calldata _datasetMultiaddr,
        bytes32 _datasetChecksum
    ) external returns (IDataset);

    function predictDataset(
        address _datasetOwner,
        string calldata _datasetName,
        bytes calldata _datasetMultiaddr,
        bytes32 _datasetChecksum
    ) external view returns (IDataset);
}
