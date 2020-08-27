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


interface IexecRelay
{
	event BroadcastAppOrder       (IexecLibOrders_v5.AppOrder        apporder       );
	event BroadcastDatasetOrder   (IexecLibOrders_v5.DatasetOrder    datasetorder   );
	event BroadcastWorkerpoolOrder(IexecLibOrders_v5.WorkerpoolOrder workerpoolorder);
	event BroadcastRequestOrder   (IexecLibOrders_v5.RequestOrder    requestorder   );

	function broadcastAppOrder       (IexecLibOrders_v5.AppOrder        calldata) external;
	function broadcastDatasetOrder   (IexecLibOrders_v5.DatasetOrder    calldata) external;
	function broadcastWorkerpoolOrder(IexecLibOrders_v5.WorkerpoolOrder calldata) external;
	function broadcastRequestOrder   (IexecLibOrders_v5.RequestOrder    calldata) external;
}
