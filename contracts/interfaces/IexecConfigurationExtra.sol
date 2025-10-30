// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.0;
pragma experimental ABIEncoderV2;

interface IexecConfigurationExtra {
    function changeRegistries(address, address, address) external;
}
