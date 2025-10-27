// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

interface IexecDepositAndMatchOrders {
    /**
     * @notice Thrown when the caller is not the requester in the request order
     */
    error CallerMustBeRequester();

    /**
     * @notice Thrown when the token transfer fails during deposit
     */
    error TokenTransferFailed();

    /**
     * @notice Deposit RLC token in your iexec account and match orders in a single transaction
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
    ) external returns (bytes32 dealId);

    event DepositAndMatch(address indexed depositor, uint256 depositedAmount, bytes32 dealId);
}
