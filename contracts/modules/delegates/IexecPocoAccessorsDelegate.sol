// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibCore_v5} from "../../libs/IexecLibCore_v5.sol";
import {DelegateBase} from "../DelegateBase.v8.sol";
import {IexecPocoBoostAccessors} from "../interfaces/IexecPocoAccessors.sol";

/**
 * @title Getters contract for PoCo module.
 */
contract IexecPocoAccessorsDelegate is IexecPocoBoostAccessors, DelegateBase {
    /**
     * Get a deal created by PoCo module.
     * @param id The ID of the deal.
     */
    function viewDeal(bytes32 id) external view returns (IexecLibCore_v5.Deal memory deal) {
        return m_deals[id];
    }

    function name() external view returns (string memory) {
        return m_name;
    }

    function symbol() external view returns (string memory) {
        return m_symbol;
    }

    function decimals() external view returns (uint8) {
        return m_decimals;
    }

    function totalSupply() external view returns (uint256) {
        return m_totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return m_balances[account];
    }

    function frozenOf(address account) external view returns (uint256) {
        return m_frozens[account];
    }

    function allowance(address account, address spender) external view returns (uint256) {
        return m_allowances[account][spender];
    }

    function viewAccount(address account) external view returns (IexecLibCore_v5.Account memory) {
        return IexecLibCore_v5.Account(m_balances[account], m_frozens[account]);
    }

    function token() external view returns (address) {
        return address(m_baseToken);
    }

    function viewConsumed(bytes32 _id) external view returns (uint256 consumed) {
        return m_consumed[_id];
    }

    function viewPresigned(bytes32 _id) external view returns (address signer) {
        return m_presigned[_id];
    }

    function viewTask(bytes32 _taskid) external view returns (IexecLibCore_v5.Task memory) {
        return m_tasks[_taskid];
    }

    function viewContribution(
        bytes32 _taskid,
        address _worker
    ) external view returns (IexecLibCore_v5.Contribution memory) {
        return m_contributions[_taskid][_worker];
    }

    function viewScore(address _worker) external view returns (uint256) {
        return m_workerScores[_worker];
    }

    function resultFor(bytes32 id) external view returns (bytes memory) {
        IexecLibCore_v5.Task storage task = m_tasks[id];
        require(task.status == IexecLibCore_v5.TaskStatusEnum.COMPLETED, "task-pending");
        return task.resultsCallback; // Expansion - result separation
    }

    function viewCategory(
        uint256 _catid
    ) external view returns (IexecLibCore_v5.Category memory category) {
        return m_categories[_catid];
    }

    function countCategory() external view returns (uint256 count) {
        return m_categories.length;
    }

    function teebroker() external view returns (address) {
        return m_teebroker;
    }

    function callbackgas() external view returns (uint256) {
        return m_callbackgas;
    }

    function contribution_deadline_ratio() external pure returns (uint256) {
        return CONTRIBUTION_DEADLINE_RATIO;
    }

    function reveal_deadline_ratio() external pure returns (uint256) {
        return REVEAL_DEADLINE_RATIO;
    }

    function final_deadline_ratio() external pure returns (uint256) {
        return FINAL_DEADLINE_RATIO;
    }

    function workerpool_stake_ratio() external pure returns (uint256) {
        return WORKERPOOL_STAKE_RATIO;
    }

    function kitty_ratio() external pure returns (uint256) {
        return KITTY_RATIO;
    }

    function kitty_min() external pure returns (uint256) {
        return KITTY_MIN;
    }

    function kitty_address() external pure returns (address) {
        return KITTY_ADDRESS;
    }

    function groupmember_purpose() external pure returns (uint256) {
        return GROUPMEMBER_PURPOSE;
    }

    function eip712domain_separator() external view returns (bytes32) {
        return EIP712DOMAIN_SEPARATOR;
    }
}
