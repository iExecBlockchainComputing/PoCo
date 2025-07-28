// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../FacetBase.sol";
import "../interfaces/IexecAccessors.sol";
import {LibPocoStorage} from "../../libs/LibPocoStorage.sol";

contract IexecAccessorsFacet is IexecAccessors, FacetBase {
    function name() external view override returns (string memory) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_name;
    }

    function symbol() external view override returns (string memory) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_symbol;
    }

    function decimals() external view override returns (uint8) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_decimals;
    }

    function totalSupply() external view override returns (uint256) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_balances[account];
    }

    function frozenOf(address account) external view override returns (uint256) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_frozens[account];
    }

    function allowance(address account, address spender) external view override returns (uint256) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_allowances[account][spender];
    }

    function viewAccount(
        address account
    ) external view override returns (IexecLibCore_v5.Account memory) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return IexecLibCore_v5.Account($.m_balances[account], $.m_frozens[account]);
    }

    function token() external view override returns (address) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return address($.m_baseToken);
    }

    function viewDeal(
        bytes32 _id
    ) external view override returns (IexecLibCore_v5.Deal memory deal) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_deals[_id];
    }

    function viewConsumed(bytes32 _id) external view override returns (uint256 consumed) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_consumed[_id];
    }

    function viewPresigned(bytes32 _id) external view override returns (address signer) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_presigned[_id];
    }

    function viewTask(
        bytes32 _taskid
    ) external view override returns (IexecLibCore_v5.Task memory) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_tasks[_taskid];
    }

    function viewContribution(
        bytes32 _taskid,
        address _worker
    ) external view override returns (IexecLibCore_v5.Contribution memory) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_contributions[_taskid][_worker];
    }

    function viewScore(address _worker) external view override returns (uint256) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_workerScores[_worker];
    }

    function resultFor(bytes32 id) external view override returns (bytes memory) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        IexecLibCore_v5.Task storage task = $.m_tasks[id];
        require(task.status == IexecLibCore_v5.TaskStatusEnum.COMPLETED, "task-pending");
        return task.resultsCallback; // Expansion - result separation
    }

    function viewCategory(
        uint256 _catid
    ) external view override returns (IexecLibCore_v5.Category memory category) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_categories[_catid];
    }

    function countCategory() external view override returns (uint256 count) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_categories.length;
    }

    function appregistry() external view override returns (IRegistry) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_appregistry;
    }

    function datasetregistry() external view override returns (IRegistry) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_datasetregistry;
    }

    function workerpoolregistry() external view override returns (IRegistry) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_workerpoolregistry;
    }

    function teebroker() external view override returns (address) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_teebroker;
    }

    function callbackgas() external view override returns (uint256) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.m_callbackgas;
    }

    function contribution_deadline_ratio() external view override returns (uint256) {
        return LibPocoStorage.getContributionDeadlineRatio();
    }

    function reveal_deadline_ratio() external view override returns (uint256) {
        return LibPocoStorage.getRevealDeadlineRatio();
    }

    function final_deadline_ratio() external view override returns (uint256) {
        return LibPocoStorage.getFinalDeadlineRatio();
    }

    function workerpool_stake_ratio() external view override returns (uint256) {
        return LibPocoStorage.getWorkerpoolStakeRatio();
    }

    function kitty_ratio() external view override returns (uint256) {
        return LibPocoStorage.getKittyRatio();
    }

    function kitty_min() external view override returns (uint256) {
        return LibPocoStorage.getKittyMin();
    }

    function kitty_address() external view override returns (address) {
        return LibPocoStorage.getKittyAddress();
    }

    function groupmember_purpose() external view override returns (uint256) {
        return LibPocoStorage.getGroupmemberPurpose();
    }

    function eip712domain_separator() external view override returns (bytes32) {
        LibPocoStorage.PocoStorage storage $ = LibPocoStorage.getPocoStorage();
        return $.EIP712DOMAIN_SEPARATOR;
    }
}
