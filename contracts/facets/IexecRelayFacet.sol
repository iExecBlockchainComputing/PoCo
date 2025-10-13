// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {FacetBase} from "./FacetBase.sol";
import {IexecRelay} from "../interfaces/IexecRelay.sol";
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

contract IexecRelayFacet is IexecRelay, FacetBase {
    function broadcastAppOrder(IexecLibOrders_v5.AppOrder calldata _apporder) external override {
        emit BroadcastAppOrder(_apporder);
    }
    function broadcastDatasetOrder(
        IexecLibOrders_v5.DatasetOrder calldata _datasetorder
    ) external override {
        emit BroadcastDatasetOrder(_datasetorder);
    }
    function broadcastWorkerpoolOrder(
        IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder
    ) external override {
        emit BroadcastWorkerpoolOrder(_workerpoolorder);
    }
    function broadcastRequestOrder(
        IexecLibOrders_v5.RequestOrder calldata _requestorder
    ) external override {
        emit BroadcastRequestOrder(_requestorder);
    }
}
