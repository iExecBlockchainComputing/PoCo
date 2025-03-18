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

interface IApp {
    function m_appName() external view returns (string memory);
    function m_appType() external view returns (string memory);
    function m_appMultiaddr() external view returns (bytes memory);
    function m_appChecksum() external view returns (bytes32);
    function m_appMREnclave() external view returns (bytes memory);
}

interface IAppRegistry {
    function createApp(
        address _appOwner,
        string calldata _appName,
        string calldata _appType,
        bytes calldata _appMultiaddr,
        bytes32 _appChecksum,
        bytes calldata _appMREnclave
    ) external returns (IApp);

    function predictApp(
        address _appOwner,
        string calldata _appName,
        string calldata _appType,
        bytes calldata _appMultiaddr,
        bytes32 _appChecksum,
        bytes calldata _appMREnclave
    ) external view returns (IApp);
}
