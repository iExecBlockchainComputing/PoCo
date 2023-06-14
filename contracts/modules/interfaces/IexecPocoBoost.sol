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
pragma experimental ABIEncoderV2;


interface IexecPocoBoost
{
	event Reward(address owner, uint256 amount, bytes32 ref);
	event Seize (address owner, uint256 amount, bytes32 ref);
	event Lock  (address owner, uint256 amount);
	event Unlock(address owner, uint256 amount);

    event OrdersMatchedBoost(bytes32 dealid);
    event ResultPushedBoost(bytes32 dealId, uint index, bytes32 result);

    function matchOrdersBoost(uint _requestorder, uint _apporder) external;
    function pushResultBoost(bytes32 _dealId, uint _index, bytes32 _result) external;
}
