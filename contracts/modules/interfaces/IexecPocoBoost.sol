// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2023 IEXEC BLOCKCHAIN TECH                                       *
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

import "../../libs/IexecLibOrders_v5.sol";

interface IexecPocoBoost {
    event SchedulerNoticeBoost(
        address indexed workerpool,
        bytes32 dealId,
        address app,
        address dataset,
        uint256 category,
        string params
    );
    event OrdersMatchedBoost(
        bytes32 dealid,
        bytes32 appHash,
        bytes32 datasetHash,
        bytes32 workerpoolHash,
        bytes32 requestHash
    );
    event ResultPushedBoost(bytes32 dealId, uint index, bytes results);

    function matchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external;

    function pushResultBoost(
        bytes32 dealId,
        uint index,
        bytes calldata results,
        bytes calldata resultsCallback,
        bytes calldata authorizationSign,
        address enclaveChallenge,
        bytes calldata enclaveSign
    ) external;
}
