// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface IWorkerpool {
    function m_schedulerRewardRatioPolicy() external returns (uint256);

    function m_workerStakeRatioPolicy() external returns (uint256);
}
