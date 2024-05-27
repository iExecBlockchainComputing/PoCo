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


interface IexecOrderManagement
{
	event SignedAppOrder       (bytes32 appHash);
	event SignedDatasetOrder   (bytes32 datasetHash);
	event SignedWorkerpoolOrder(bytes32 workerpoolHash);
	event SignedRequestOrder   (bytes32 requestHash);
	event ClosedAppOrder       (bytes32 appHash);
	event ClosedDatasetOrder   (bytes32 datasetHash);
	event ClosedWorkerpoolOrder(bytes32 workerpoolHash);
	event ClosedRequestOrder   (bytes32 requestHash);

	function manageAppOrder       (IexecLibOrders_v5.AppOrderOperation        calldata) external;
	function manageDatasetOrder   (IexecLibOrders_v5.DatasetOrderOperation    calldata) external;
	function manageWorkerpoolOrder(IexecLibOrders_v5.WorkerpoolOrderOperation calldata) external;
	function manageRequestOrder   (IexecLibOrders_v5.RequestOrderOperation    calldata) external;
}
