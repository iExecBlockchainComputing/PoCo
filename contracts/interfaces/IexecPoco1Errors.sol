// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface IexecPoco1Errors {
    // TODO put this in `IexecPoco1` when it is migrated to Solidity v8.
    error IncompatibleDatasetOrder(string reason);

    /**
     * @notice Thrown when the caller is not the requester in the request order
     */
    error CallerMustBeRequester();

    /**
     * @notice Thrown when the token transfer fails during deposit
     */
    error TokenTransferFailed();
}
