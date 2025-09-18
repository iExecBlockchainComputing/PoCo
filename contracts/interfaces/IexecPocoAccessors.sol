// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibCore_v5} from "../libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";
import {IRegistry} from "../libs/PocoStorageLib.v8.sol";

interface IexecPocoAccessors {
    // ========= Deal and Task Accessors =========
    function viewDeal(bytes32 id) external view returns (IexecLibCore_v5.Deal memory);

    function viewTask(bytes32 id) external view returns (IexecLibCore_v5.Task memory);

    function computeDealVolume(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external view returns (uint256);

    function viewConsumed(bytes32 _id) external view returns (uint256 consumed);

    function viewPresigned(bytes32 _id) external view returns (address signer);

    function viewContribution(
        bytes32 _taskid,
        address _worker
    ) external view returns (IexecLibCore_v5.Contribution memory);

    function viewScore(address _worker) external view returns (uint256);

    function resultFor(bytes32 id) external view returns (bytes memory);

    // ========= Token and Account Accessors =========
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function frozenOf(address account) external view returns (uint256);
    function allowance(address account, address spender) external view returns (uint256);
    function viewAccount(address account) external view returns (IexecLibCore_v5.Account memory);
    function token() external view returns (address);

    // ========= Category Accessors =========
    function viewCategory(uint256 _catid) external view returns (IexecLibCore_v5.Category memory);
    function countCategory() external view returns (uint256);

    // ========= Registry Accessors =========
    function appregistry() external view returns (IRegistry);
    function datasetregistry() external view returns (IRegistry);
    function workerpoolregistry() external view returns (IRegistry);
    function teebroker() external view returns (address);
    function callbackgas() external view returns (uint256);

    // ========= Constants Accessors =========
    function contribution_deadline_ratio() external view returns (uint256);
    function reveal_deadline_ratio() external view returns (uint256);
    function final_deadline_ratio() external view returns (uint256);
    function workerpool_stake_ratio() external view returns (uint256);
    function kitty_ratio() external view returns (uint256);
    function kitty_min() external view returns (uint256);
    function kitty_address() external view returns (address);
    function groupmember_purpose() external view returns (uint256);
    function eip712domain_separator() external view returns (bytes32);
}
