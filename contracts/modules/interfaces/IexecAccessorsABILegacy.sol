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

import "../../libs/IexecLibCore_v5.sol";


interface IexecAccessorsABILegacy
{
	function viewAccountABILegacy(address _user)
	external view returns (uint256, uint256);

	function viewDealABILegacy_pt1(bytes32 _id)
	external view returns
	( address
	, address
	, uint256
	, address
	, address
	, uint256
	, address
	, address
	, uint256
	);

	function viewDealABILegacy_pt2(bytes32 _id)
	external view returns
	( uint256
	, bytes32
	, address
	, address
	, address
	, string memory
	);

	function viewTaskABILegacy(bytes32 _taskid)
	external view returns
	( IexecLibCore_v5.TaskStatusEnum
	, bytes32
	, uint256
	, uint256
	, uint256
	, uint256
	, uint256
	, bytes32
	, uint256
	, uint256
	, address[] memory
	, bytes     memory
	);

	function viewContributionABILegacy(bytes32 _taskid, address _worker)
	external view returns
	( IexecLibCore_v5.ContributionStatusEnum
	, bytes32
	, bytes32
	, address
	);

	function viewCategoryABILegacy(uint256 _catid)
	external view returns (string memory, string memory, uint256);

	function viewConfigABILegacy(bytes32 _id)
	external view returns
	( uint256
	, uint256
	, uint256
	, uint256
	, uint256
	, uint256
	);
}
