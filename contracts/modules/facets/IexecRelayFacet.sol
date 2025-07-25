// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../FacetBase.sol";
import "../interfaces/IexecRelay.sol";

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
