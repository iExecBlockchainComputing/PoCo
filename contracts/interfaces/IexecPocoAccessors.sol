// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibCore_v5} from "../libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

interface IexecPocoAccessors {
    function viewDeal(bytes32 id) external view returns (IexecLibCore_v5.Deal memory);

    function viewTask(bytes32 id) external view returns (IexecLibCore_v5.Task memory);

    function computeDealVolume(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external view returns (uint256);
}
