// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

interface IexecConfiguration {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Contract already configured with EIP-712 domain separator
     */
    error AlreadyConfigured();

    /**
     * @notice Contract not yet configured
     */
    error NotConfigured();

    /**
     * @notice Worker score already imported from v3
     * @param worker The worker address
     */
    error ScoreAlreadyImported(address worker);

    function configure(
        address,
        string calldata,
        string calldata,
        uint8,
        address,
        address,
        address,
        address
    ) external;
    function domain() external view returns (IexecLibOrders_v5.EIP712Domain memory);
    function updateDomainSeparator() external;
    function importScore(address) external;
    function setTeeBroker(address) external;
    function setCallbackGas(uint256) external;
}
