// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

interface IexecPoco1 {
    event SchedulerNotice(address indexed workerpool, bytes32 dealid);
    event OrdersMatched(
        bytes32 dealid,
        bytes32 appHash,
        bytes32 datasetHash,
        bytes32 workerpoolHash,
        bytes32 requestHash,
        uint256 volume
    );
    event DealSponsored(bytes32 dealId, address sponsor);

    function verifySignature(address, bytes32, bytes calldata) external view returns (bool);

    function verifyPresignature(address, bytes32) external view returns (bool);

    function verifyPresignatureOrSignature(
        address,
        bytes32,
        bytes calldata
    ) external view returns (bool);

    function assertDatasetDealCompatibility(
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        bytes32 dealId
    ) external view;

    function matchOrders(
        IexecLibOrders_v5.AppOrder calldata,
        IexecLibOrders_v5.DatasetOrder calldata,
        IexecLibOrders_v5.WorkerpoolOrder calldata,
        IexecLibOrders_v5.RequestOrder calldata
    ) external returns (bytes32);

    function sponsorMatchOrders(
        IexecLibOrders_v5.AppOrder calldata,
        IexecLibOrders_v5.DatasetOrder calldata,
        IexecLibOrders_v5.WorkerpoolOrder calldata,
        IexecLibOrders_v5.RequestOrder calldata
    ) external returns (bytes32);

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
}
