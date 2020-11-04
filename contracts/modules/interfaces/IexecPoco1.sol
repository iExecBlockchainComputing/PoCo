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

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../../libs/IexecLibOrders_v5.sol";


interface IexecPoco1
{
	event Reward(address owner, uint256 amount, bytes32 ref);
	event Seize (address owner, uint256 amount, bytes32 ref);
	event Lock  (address owner, uint256 amount);
	event Unlock(address owner, uint256 amount);

	event OrdersMatched  (bytes32 dealid, bytes32 appHash, bytes32 datasetHash, bytes32 workerpoolHash, bytes32 requestHash, uint256 volume);
	event SchedulerNotice(address indexed workerpool, bytes32 dealid);

	function verifySignature(address,bytes32,bytes calldata) external view returns (bool);
	function verifyPresignature(address,bytes32) external view returns (bool);
	function verifyPresignatureOrSignature(address,bytes32,bytes calldata) external view returns (bool);
	function matchOrders(IexecLibOrders_v5.AppOrder calldata,IexecLibOrders_v5.DatasetOrder calldata,IexecLibOrders_v5.WorkerpoolOrder calldata,IexecLibOrders_v5.RequestOrder calldata) external returns (bytes32);
}
