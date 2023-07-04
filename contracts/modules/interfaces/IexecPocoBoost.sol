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
    event OrdersMatchedBoost(bytes32 dealid);
    event ResultPushedBoost(bytes32 dealId, uint index, bytes32 result);

    function matchOrdersBoost(
        IexecLibOrders_v5.RequestOrder calldata,
        IexecLibOrders_v5.AppOrder calldata
    ) external;

    function pushResultBoost(bytes32 _dealId, uint _index, bytes32 _result) external;
}
