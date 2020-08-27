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


interface IexecPoco
{
	event Reward  (address owner, uint256 amount, bytes32 ref);
	event Seize   (address owner, uint256 amount, bytes32 ref);
	event Lock    (address owner, uint256 amount);
	event Unlock  (address owner, uint256 amount);

	event OrdersMatched  (bytes32 dealid, bytes32 appHash, bytes32 datasetHash, bytes32 workerpoolHash, bytes32 requestHash, uint256 volume);
	event SchedulerNotice(address indexed workerpool, bytes32 dealid);

	event TaskInitialize(bytes32 indexed taskid, address indexed workerpool);
	event TaskContribute(bytes32 indexed taskid, address indexed worker, bytes32 hash);
	event TaskConsensus (bytes32 indexed taskid, bytes32 consensus);
	event TaskReveal    (bytes32 indexed taskid, address indexed worker, bytes32 digest);
	event TaskReopen    (bytes32 indexed taskid);
	event TaskFinalize  (bytes32 indexed taskid, bytes results);
	event TaskClaimed   (bytes32 indexed taskid);

	event AccurateContribution(address indexed worker, bytes32 indexed taskid);
	event FaultyContribution  (address indexed worker, bytes32 indexed taskid);

	function verifySignature(address,bytes32,bytes calldata) external view returns (bool);
	function verifyPresignature(address,bytes32) external view returns (bool);
	function verifyPresignatureOrSignature(address,bytes32,bytes calldata) external view returns (bool);
	function matchOrders(IexecLibOrders_v5.AppOrder calldata,IexecLibOrders_v5.DatasetOrder calldata,IexecLibOrders_v5.WorkerpoolOrder calldata,IexecLibOrders_v5.RequestOrder calldata) external returns (bytes32);
	function initialize(bytes32,uint256) external returns (bytes32);
	function contribute(bytes32,bytes32,bytes32,address,bytes calldata,bytes calldata) external;
	function reveal(bytes32,bytes32) external;
	function reopen(bytes32) external;
	function finalize(bytes32,bytes calldata,bytes calldata) external; // Expansion - result separation
	function claim(bytes32) external;
	function contributeAndFinalize(bytes32,bytes32,bytes calldata,bytes calldata,address,bytes calldata,bytes calldata) external; // Expansion - result separation
	function initializeArray(bytes32[] calldata,uint256[] calldata) external returns (bool);
	function claimArray(bytes32[] calldata) external returns (bool);
	function initializeAndClaimArray(bytes32[] calldata,uint256[] calldata) external returns (bool);
}
