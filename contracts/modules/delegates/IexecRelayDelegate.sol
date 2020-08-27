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

import "../DelegateBase.sol";
import "../interfaces/IexecRelay.sol";


contract IexecRelayDelegate is IexecRelay, DelegateBase
{
	function broadcastAppOrder       (IexecLibOrders_v5.AppOrder        calldata _apporder       ) external override { emit BroadcastAppOrder       (_apporder       ); }
	function broadcastDatasetOrder   (IexecLibOrders_v5.DatasetOrder    calldata _datasetorder   ) external override { emit BroadcastDatasetOrder   (_datasetorder   ); }
	function broadcastWorkerpoolOrder(IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder) external override { emit BroadcastWorkerpoolOrder(_workerpoolorder); }
	function broadcastRequestOrder   (IexecLibOrders_v5.RequestOrder    calldata _requestorder   ) external override { emit BroadcastRequestOrder   (_requestorder   ); }
}
