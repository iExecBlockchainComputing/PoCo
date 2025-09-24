// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface IWorkerpool {
    function owner() external view returns (address);

    function m_workerpoolDescription() external view returns (string memory);

    function m_schedulerRewardRatioPolicy() external view returns (uint256);

    function m_workerStakeRatioPolicy() external view returns (uint256);
}
