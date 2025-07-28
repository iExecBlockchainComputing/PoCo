// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Math} from "@openzeppelin/contracts-v5/utils/math/Math.sol";

import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";
import {FacetBase} from "../FacetBase.v8.sol";
import {LibPocoStorage} from "../../libs/LibPocoStorage.v8.sol";

contract IexecPocoCommonFacet is FacetBase {
    using Math for uint256;
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

    /**
     * @notice Internal function to compute the deal volume considering the minimum
     * remaining volume across all provided orders. This ensures that the deal volume
     * does not exceed the available volume of any individual order.
     *
     * @param appOrderVolume The volume of the app order.
     * @param appOrderTypedDataHash The typed data hash of the app order.
     * @param hasDataset Indicates if there is a dataset order.
     * @param datasetOrderVolume The volume of the dataset order.
     * @param datasetOrderTypedDataHash The typed data hash of the dataset order.
     * @param workerpoolOrderVolume The volume of the workerpool order.
     * @param workerpoolOrderTypedDataHash The typed data hash of the workerpool order.
     * @param requestOrderVolume The volume of the request order.
     * @param requestOrderTypedDataHash The typed data hash of the request order.
     * @return The minimum volume available across all orders.
     */
    function _computeDealVolume(
        uint256 appOrderVolume,
        bytes32 appOrderTypedDataHash,
        bool hasDataset,
        uint256 datasetOrderVolume,
        bytes32 datasetOrderTypedDataHash,
        uint256 workerpoolOrderVolume,
        bytes32 workerpoolOrderTypedDataHash,
        uint256 requestOrderVolume,
        bytes32 requestOrderTypedDataHash
    ) internal view returns (uint256) {
        return
            (appOrderVolume - LibPocoStorage.consumed(appOrderTypedDataHash))
                .min(
                    hasDataset
                        ? datasetOrderVolume - LibPocoStorage.consumed(datasetOrderTypedDataHash)
                        : type(uint256).max
                )
                .min(workerpoolOrderVolume - LibPocoStorage.consumed(workerpoolOrderTypedDataHash))
                .min(requestOrderVolume - LibPocoStorage.consumed(requestOrderTypedDataHash));
    }
}
