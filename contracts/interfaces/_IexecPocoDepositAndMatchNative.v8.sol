// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

interface IexecPocoDepositAndMatch {
    /**
     * @notice Deposit tokens/ETH and match orders in a single transaction
     * @dev This function allows builders to deposit the required amount and match orders atomically,
     *      improving UX by eliminating the need for separate deposit transactions
     * @param _apporder The app order
     * @param _datasetorder The dataset order
     * @param _workerpoolorder The workerpool order
     * @param _requestorder The request order
     * @return dealId The ID of the created deal
     */
    function depositAndMatchOrders(
        IexecLibOrders_v5.AppOrder calldata _apporder,
        IexecLibOrders_v5.DatasetOrder calldata _datasetorder,
        IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder,
        IexecLibOrders_v5.RequestOrder calldata _requestorder
    ) external payable returns (bytes32 dealId);

    /**
     * @notice Deposit tokens/ETH and sponsor match orders for another requester in a single transaction
     * @dev This function allows anyone to deposit and sponsor a deal for a third party requester
     * @param _apporder The app order
     * @param _datasetorder The dataset order
     * @param _workerpoolorder The workerpool order
     * @param _requestorder The request order
     * @return dealId The ID of the created deal
     */
    function depositAndSponsorMatchOrders(
        IexecLibOrders_v5.AppOrder calldata _apporder,
        IexecLibOrders_v5.DatasetOrder calldata _datasetorder,
        IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder,
        IexecLibOrders_v5.RequestOrder calldata _requestorder
    ) external payable returns (bytes32 dealId);

    event DepositAndMatch(address indexed depositor, uint256 depositedAmount, bytes32 dealId);
}
