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

import {IWorkerpoolRegistry} from "../../registries/workerpools/IWorkerpoolRegistry.sol";
import {IDatasetRegistry} from "../../registries/datasets/IDatasetRegistry.sol";
import {IAppRegistry} from "../../registries/apps/IAppRegistry.sol";
interface IexecPoco {
    function appregistry() external view returns (IAppRegistry);
    function datasetregistry() external view returns (IDatasetRegistry);
    function workerpoolregistry() external view returns (IWorkerpoolRegistry);
}
