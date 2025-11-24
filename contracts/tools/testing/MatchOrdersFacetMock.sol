// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";

/**
 * @notice Helper contract to test edge cases in receiveApproval function
 * @dev This contract simulates a matchOrders that fails silently (no error data)
 */
contract MatchOrdersFacetMock {
    /**
     * @notice Mock matchOrders function that fails with empty error data
     */
    function matchOrders(
        IexecLibOrders_v5.AppOrder calldata,
        IexecLibOrders_v5.DatasetOrder calldata,
        IexecLibOrders_v5.WorkerpoolOrder calldata,
        IexecLibOrders_v5.RequestOrder calldata
    ) external pure returns (bytes32) {
        // Revert without any error data
        // This simulates: delegatecall fails with success=false and result.length=0
        revert();
    }
}
