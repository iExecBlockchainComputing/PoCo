// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../../libs/IexecLibOrders_v5.sol";

interface IexecOrderManagement {
    event SignedAppOrder(bytes32 appHash);
    event SignedDatasetOrder(bytes32 datasetHash);
    event SignedWorkerpoolOrder(bytes32 workerpoolHash);
    event SignedRequestOrder(bytes32 requestHash);
    event ClosedAppOrder(bytes32 appHash);
    event ClosedDatasetOrder(bytes32 datasetHash);
    event ClosedWorkerpoolOrder(bytes32 workerpoolHash);
    event ClosedRequestOrder(bytes32 requestHash);

    function manageAppOrder(IexecLibOrders_v5.AppOrderOperation calldata) external;

    function manageDatasetOrder(IexecLibOrders_v5.DatasetOrderOperation calldata) external;

    function manageWorkerpoolOrder(IexecLibOrders_v5.WorkerpoolOrderOperation calldata) external;

    function manageRequestOrder(IexecLibOrders_v5.RequestOrderOperation calldata) external;
}
