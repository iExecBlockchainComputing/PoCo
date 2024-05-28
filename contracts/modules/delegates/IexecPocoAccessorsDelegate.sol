// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibCore_v5} from "../../libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";
import {DelegateBase} from "../DelegateBase.v8.sol";
import {IexecPocoAccessors} from "../interfaces/IexecPocoAccessors.sol";
import {SignatureVerifier} from "./SignatureVerifier.v8.sol";
import {IexecPocoCommonDelegate} from "./IexecPocoCommonDelegate.sol";

/**
 * @title Getters contract for PoCo module.
 */
contract IexecPocoAccessorsDelegate is
    IexecPocoAccessors,
    DelegateBase,
    SignatureVerifier,
    IexecPocoCommonDelegate
{
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

    /**
     * Get a deal created by PoCo module.
     * @param id The ID of the deal.
     */
    function viewDeal(bytes32 id) external view returns (IexecLibCore_v5.Deal memory deal) {
        return m_deals[id];
    }

    /**
     * Get task created in Classic mode.
     * @param id id of the task
     */
    function viewTask(bytes32 id) external view returns (IexecLibCore_v5.Task memory) {
        return m_tasks[id];
    }

    /**
     * @notice Computes the predicted deal volume based on the provided orders.
     * This function should only be used if the deal is not yet created.
     * For existing deals, use the deal accessors instead.
     *
     * @param appOrder The application order.
     * @param datasetOrder The dataset order.
     * @param workerpoolOrder The workerpool order.
     * @param requestOrder The request order.
     * @return The computed deal volume.
     */
    function computeDealVolume(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external view override returns (uint256) {
        return
            _computeDealVolume(
                appOrder.volume,
                _toTypedDataHash(appOrder.hash()),
                datasetOrder.dataset != address(0),
                datasetOrder.volume,
                _toTypedDataHash(datasetOrder.hash()),
                workerpoolOrder.volume,
                _toTypedDataHash(workerpoolOrder.hash()),
                requestOrder.volume,
                _toTypedDataHash(requestOrder.hash())
            );
    }
}
