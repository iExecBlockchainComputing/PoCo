// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IexecCategoryManager {
    event CreateCategory(uint256 catid, string name, string description, uint256 workClockTimeRef);

    function createCategory(string calldata, string calldata, uint256) external returns (uint256);
}
