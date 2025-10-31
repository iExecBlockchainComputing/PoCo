// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.0;
pragma experimental ABIEncoderV2;

import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

interface IexecRelay {
    event BroadcastAppOrder(IexecLibOrders_v5.AppOrder apporder);
    event BroadcastDatasetOrder(IexecLibOrders_v5.DatasetOrder datasetorder);
    event BroadcastWorkerpoolOrder(IexecLibOrders_v5.WorkerpoolOrder workerpoolorder);
    event BroadcastRequestOrder(IexecLibOrders_v5.RequestOrder requestorder);

    function broadcastAppOrder(IexecLibOrders_v5.AppOrder calldata) external;
    function broadcastDatasetOrder(IexecLibOrders_v5.DatasetOrder calldata) external;
    function broadcastWorkerpoolOrder(IexecLibOrders_v5.WorkerpoolOrder calldata) external;
    function broadcastRequestOrder(IexecLibOrders_v5.RequestOrder calldata) external;
}
