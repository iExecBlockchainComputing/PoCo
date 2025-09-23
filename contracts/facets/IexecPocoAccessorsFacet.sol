// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {PocoStorageLib, IRegistry} from "../libs/PocoStorageLib.v8.sol";
import {FacetBase} from "./FacetBase.v8.sol";
import {IexecLibCore_v5} from "../libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";
import {IexecPocoAccessors} from "../interfaces/IexecPocoAccessors.sol";
import {IexecPocoCommon} from "./IexecPocoCommon.sol";
import {SignatureVerifier} from "./SignatureVerifier.v8.sol";

interface DatasetInterface {
    function owner() external view returns (address);
    function m_datasetName() external view returns (string memory);
    function m_datasetMultiaddr() external view returns (bytes memory);
    function m_datasetChecksum() external view returns (bytes32);
}

interface AppInterface {
    function owner() external view returns (address);
    function m_appName() external view returns (string memory);
    function m_appType() external view returns (string memory);
    function m_appMultiaddr() external view returns (bytes memory);
    function m_appChecksum() external view returns (bytes32);
    function m_appMREnclave() external view returns (bytes memory);
}

interface WorkerpoolInterface {
    function owner() external view returns (address);
    function m_workerpoolDescription() external view returns (string memory);
    function m_workerStakeRatioPolicy() external view returns (uint256);
    function m_schedulerRewardRatioPolicy() external view returns (uint256);
}

/**
 * @title Getters contract for PoCo facets.
 */
contract IexecPocoAccessorsFacet is
    IexecPocoAccessors,
    FacetBase,
    SignatureVerifier,
    IexecPocoCommon
{
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

    // ========= Deal and Task Accessors =========
    /**
     * Get a deal created by PoCo classic facet.
     * @param id The ID of the deal.
     */
    function viewDeal(bytes32 id) external view returns (IexecLibCore_v5.Deal memory deal) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_deals[id];
    }

    /**
     * Get task created in Classic mode.
     * @param id id of the task
     */
    function viewTask(bytes32 id) external view returns (IexecLibCore_v5.Task memory) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_tasks[id];
    }

    /**
     * @notice Computes the volume of the "not yet created" deal based on the provided orders.
     * This function should only be used if the deal is not yet created.
     * For existing deals, use the deal accessors instead.
     *
     * @param appOrder The application order.
     * @param datasetOrder The dataset order.
     * @param workerpoolOrder The workerpool order.
     * @param requestOrder The request order.
     * @return The computed deal volume.
     */
    function computeDealVolume(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external view override returns (uint256) {
        return
            _computeDealVolume(
                appOrder.volume,
                _toTypedDataHash(appOrder.hash()),
                datasetOrder.dataset != address(0),
                datasetOrder.volume,
                _toTypedDataHash(datasetOrder.hash()),
                workerpoolOrder.volume,
                _toTypedDataHash(workerpoolOrder.hash()),
                requestOrder.volume,
                _toTypedDataHash(requestOrder.hash())
            );
    }

    function viewConsumed(bytes32 _id) external view returns (uint256 consumed) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_consumed[_id];
    }

    function viewPresigned(bytes32 _id) external view returns (address signer) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_presigned[_id];
    }

    function viewContribution(
        bytes32 _taskid,
        address _worker
    ) external view returns (IexecLibCore_v5.Contribution memory) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_contributions[_taskid][_worker];
    }

    function viewScore(address _worker) external view returns (uint256) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_workerScores[_worker];
    }

    function resultFor(bytes32 id) external view returns (bytes memory) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        IexecLibCore_v5.Task storage task = $.m_tasks[id];
        require(task.status == IexecLibCore_v5.TaskStatusEnum.COMPLETED, "task-pending");
        return task.resultsCallback; // Expansion - result separation
    }

    // ========= SRLC Token and Account Accessors =========

    function name() external view returns (string memory) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_name;
    }

    function symbol() external view returns (string memory) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_symbol;
    }

    function decimals() external view returns (uint8) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_decimals;
    }

    function totalSupply() external view returns (uint256) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_balances[account];
    }

    function frozenOf(address account) external view returns (uint256) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_frozens[account];
    }

    function allowance(address account, address spender) external view returns (uint256) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_allowances[account][spender];
    }

    function viewAccount(address account) external view returns (IexecLibCore_v5.Account memory) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return IexecLibCore_v5.Account($.m_balances[account], $.m_frozens[account]);
    }

    function token() external view returns (address) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return address($.m_baseToken);
    }

    // ========= Category Accessors =========

    function viewCategory(
        uint256 _catid
    ) external view returns (IexecLibCore_v5.Category memory category) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        if (_catid >= $.m_categories.length) {
            revert(); // Intentionally revert without reason instead of panic for retro-compatibility with the old interface
        }
        return $.m_categories[_catid];
    }

    function countCategory() external view returns (uint256 count) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_categories.length;
    }

    // ========= Registry Accessors =========

    function appregistry() external view returns (IRegistry) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_appregistry;
    }

    function datasetregistry() external view returns (IRegistry) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_datasetregistry;
    }

    function workerpoolregistry() external view returns (IRegistry) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_workerpoolregistry;
    }

    function teebroker() external view returns (address) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_teebroker;
    }

    function callbackgas() external view returns (uint256) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_callbackgas;
    }

    // ========= Dataset Accessors =========

    function viewDataset(
        address dataset
    ) external view returns (IexecLibCore_v5.DatasetInfo memory) {
        DatasetInterface datasetContract = DatasetInterface(dataset);
        return
            IexecLibCore_v5.DatasetInfo({
                owner: datasetContract.owner(),
                m_datasetName: datasetContract.m_datasetName(),
                m_datasetMultiaddr: datasetContract.m_datasetMultiaddr(),
                m_datasetChecksum: datasetContract.m_datasetChecksum()
            });
    }

    // ========= App Accessors =========

    function viewApp(address app) external view returns (IexecLibCore_v5.AppInfo memory) {
        AppInterface appContract = AppInterface(app);
        return
            IexecLibCore_v5.AppInfo({
                owner: appContract.owner(),
                m_appName: appContract.m_appName(),
                m_appType: appContract.m_appType(),
                m_appMultiaddr: appContract.m_appMultiaddr(),
                m_appChecksum: appContract.m_appChecksum(),
                m_appMREnclave: appContract.m_appMREnclave()
            });
    }

    // ========= Workerpool Accessors =========

    function viewWorkerpool(
        address workerpool
    ) external view returns (IexecLibCore_v5.WorkerpoolInfo memory) {
        WorkerpoolInterface workerpoolContract = WorkerpoolInterface(workerpool);
        return
            IexecLibCore_v5.WorkerpoolInfo({
                owner: workerpoolContract.owner(),
                m_workerpoolDescription: workerpoolContract.m_workerpoolDescription(),
                m_workerStakeRatioPolicy: workerpoolContract.m_workerStakeRatioPolicy(),
                m_schedulerRewardRatioPolicy: workerpoolContract.m_schedulerRewardRatioPolicy()
            });
    }

    // ========= Constants Accessors =========

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
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return $.m_eip712DomainSeparator;
    }
}
