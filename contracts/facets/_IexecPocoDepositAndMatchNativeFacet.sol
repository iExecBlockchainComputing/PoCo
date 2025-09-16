// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";
import {IexecPocoDepositAndMatch} from "../interfaces/_IexecPocoDepositAndMatchNative.v8.sol";
import {IexecPoco1} from "../interfaces/IexecPoco1.v8.sol";
import {FacetBase} from "./FacetBase.v8.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.v8.sol";
import {IexecEscrow} from "./IexecEscrow.v8.sol";
import {SignatureVerifier} from "./SignatureVerifier.v8.sol";
import {IexecPocoCommon} from "./IexecPocoCommon.sol";

/**
 * @title IexecPocoDepositAndMatchNativeFacet
 * @notice Facet that combines deposit and order matching for native ETH-based PoCo deployments
 * @dev This facet allows builders to deposit ETH and match orders in a single transaction,
 *      significantly improving the user experience for native iExec chains
 */
contract IexecPocoDepositAndMatchNativeFacet is
    IexecPocoDepositAndMatch,
    FacetBase,
    IexecEscrow,
    SignatureVerifier,
    IexecPocoCommon
{
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

    uint256 private constant nRLCtoWei = 10 ** 9;

    /**
     * @notice Deposit ETH and match orders in a single transaction
     * @dev The requester (msg.sender) will be both the depositor and the sponsor of the deal
     * @param _apporder The app order
     * @param _datasetorder The dataset order
     * @param _workerpoolorder The workerpool order
     * @param _requestorder The request order
     * @return dealId The ID of the created deal
     */
    function depositAndMatchOrders(
        IexecLibOrders_v5.AppOrder calldata _apporder,
        IexecLibOrders_v5.DatasetOrder calldata _datasetorder,
        IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder,
        IexecLibOrders_v5.RequestOrder calldata _requestorder
    ) external payable override returns (bytes32 dealId) {
        require(_requestorder.requester == msg.sender, "DepositAndMatch: Caller must be requester");
        require(msg.value > 0, "DepositAndMatch: ETH deposit required");

        // Calculate required deal cost
        uint256 taskPrice = _apporder.appprice +
            _datasetorder.datasetprice +
            _workerpoolorder.workerpoolprice;
        uint256 volume = _computeDealVolume(
            _apporder.volume,
            _toTypedDataHash(_apporder.hash()),
            _datasetorder.dataset != address(0),
            _datasetorder.volume,
            _toTypedDataHash(_datasetorder.hash()),
            _workerpoolorder.volume,
            _toTypedDataHash(_workerpoolorder.hash()),
            _requestorder.volume,
            _toTypedDataHash(_requestorder.hash())
        );
        uint256 dealCost = taskPrice * volume;

        // Convert ETH to nRLC equivalent
        uint256 nRLCFromETH = msg.value / nRLCtoWei;

        // Check current balance
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        uint256 currentBalance = $.m_balances[msg.sender];

        // Only deposit if current balance is insufficient
        if (currentBalance < dealCost) {
            uint256 requiredDeposit = dealCost - currentBalance;
            require(nRLCFromETH >= requiredDeposit, "DepositAndMatch: Insufficient ETH deposit");

            // Perform the ETH deposit (convert to nRLC)
            _depositETH(msg.sender, nRLCFromETH);
        } else {
            // Still need to handle the ETH deposit even if balance is sufficient
            _depositETH(msg.sender, nRLCFromETH);
        }

        // Refund excess ETH if any
        uint256 usedETH = nRLCFromETH * nRLCtoWei;
        if (msg.value > usedETH) {
            _safeTransferETH(msg.sender, msg.value - usedETH);
        }

        // Match the orders with the requester as sponsor
        dealId = IexecPoco1(address(this)).matchOrders(
            _apporder,
            _datasetorder,
            _workerpoolorder,
            _requestorder
        );

        emit DepositAndMatch(msg.sender, nRLCFromETH, dealId);
        return dealId;
    }

    /**
     * @notice Deposit ETH and sponsor match orders for another requester
     * @dev The caller (msg.sender) will be the depositor and sponsor, while the requester is specified in the request order
     * @param _apporder The app order
     * @param _datasetorder The dataset order
     * @param _workerpoolorder The workerpool order
     * @param _requestorder The request order
     * @return dealId The ID of the created deal
     */
    function depositAndSponsorMatchOrders(
        IexecLibOrders_v5.AppOrder calldata _apporder,
        IexecLibOrders_v5.DatasetOrder calldata _datasetorder,
        IexecLibOrders_v5.WorkerpoolOrder calldata _workerpoolorder,
        IexecLibOrders_v5.RequestOrder calldata _requestorder
    ) external payable override returns (bytes32 dealId) {
        require(msg.value > 0, "DepositAndMatch: ETH deposit required");

        // Calculate required deal cost
        uint256 taskPrice = _apporder.appprice +
            _datasetorder.datasetprice +
            _workerpoolorder.workerpoolprice;
        uint256 volume = _computeDealVolume(
            _apporder.volume,
            _toTypedDataHash(_apporder.hash()),
            _datasetorder.dataset != address(0),
            _datasetorder.volume,
            _toTypedDataHash(_datasetorder.hash()),
            _workerpoolorder.volume,
            _toTypedDataHash(_workerpoolorder.hash()),
            _requestorder.volume,
            _toTypedDataHash(_requestorder.hash())
        );
        uint256 dealCost = taskPrice * volume;

        // Convert ETH to nRLC equivalent
        uint256 nRLCFromETH = msg.value / nRLCtoWei;

        // Check current balance of the sponsor (msg.sender, not the requester)
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        uint256 currentBalance = $.m_balances[msg.sender];

        // Only deposit if current balance is insufficient
        if (currentBalance < dealCost) {
            uint256 requiredDeposit = dealCost - currentBalance;
            require(nRLCFromETH >= requiredDeposit, "DepositAndMatch: Insufficient ETH deposit");

            // Perform the ETH deposit (convert to nRLC)
            _depositETH(msg.sender, nRLCFromETH);
        } else {
            // Still need to handle the ETH deposit even if balance is sufficient
            _depositETH(msg.sender, nRLCFromETH);
        }

        // Refund excess ETH if any
        uint256 usedETH = nRLCFromETH * nRLCtoWei;
        if (msg.value > usedETH) {
            _safeTransferETH(msg.sender, msg.value - usedETH);
        }

        // Match the orders with the caller as sponsor
        dealId = IexecPoco1(address(this)).sponsorMatchOrders(
            _apporder,
            _datasetorder,
            _workerpoolorder,
            _requestorder
        );

        emit DepositAndMatch(msg.sender, nRLCFromETH, dealId);
        return dealId;
    }

    /**
     * @notice Internal function to handle ETH deposits
     * @dev This function handles the ETH to nRLC conversion and balance updates
     * @param depositor The account making the deposit
     * @param nRLCAmount The amount in nRLC to credit
     */
    function _depositETH(address depositor, uint256 nRLCAmount) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();

        // Mint equivalent PoCo tokens to depositor
        $.m_balances[depositor] += nRLCAmount;
        $.m_totalSupply += nRLCAmount;

        // Emit transfer event for ERC20 compatibility
        emit Transfer(address(0), depositor, nRLCAmount);
    }

    /**
     * @notice Internal function to safely transfer ETH
     * @dev Uses call to transfer ETH and handles failures gracefully
     * @param to The recipient address
     * @param amount The amount of ETH to transfer
     */
    function _safeTransferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "DepositAndMatch: ETH transfer failed");
    }
}
