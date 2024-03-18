// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";

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
}
