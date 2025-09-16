// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";
import {IexecPocoDepositAndMatch} from "../interfaces/IexecPocoDepositAndMatchToken.v8.sol";
import {IexecPoco1} from "../interfaces/IexecPoco1.v8.sol";
import {FacetBase} from "./FacetBase.v8.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.v8.sol";
import {IexecEscrow} from "./IexecEscrow.v8.sol";
import {SignatureVerifier} from "./SignatureVerifier.v8.sol";
import {IexecPocoCommon} from "./IexecPocoCommon.sol";

/**
 * @title IexecPocoDepositAndMatchTokenFacet
 * @notice Facet that combines deposit and order matching for token-based PoCo deployments
 * @dev This facet allows builders to deposit RLC tokens and match orders in a single transaction,
 *      significantly improving the user experience by eliminating the need for separate approve+deposit+match transactions
 */
contract IexecPocoDepositAndMatchTokenFacet is
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

    /**
     * @notice Deposit RLC tokens and match orders in a single transaction
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
    ) external override returns (bytes32 dealId) {
        require(_requestorder.requester == msg.sender, "DepositAndMatch: Caller must be requester");

        // Calculate required deal cost
        bool hasDataset = _datasetorder.dataset != address(0);
        uint256 taskPrice = _apporder.appprice +
            (hasDataset ? _datasetorder.datasetprice : 0) +
            _workerpoolorder.workerpoolprice;
        uint256 volume = _computeDealVolume(
            _apporder.volume,
            _toTypedDataHash(_apporder.hash()),
            hasDataset,
            _datasetorder.volume,
            _toTypedDataHash(_datasetorder.hash()),
            _workerpoolorder.volume,
            _toTypedDataHash(_workerpoolorder.hash()),
            _requestorder.volume,
            _toTypedDataHash(_requestorder.hash())
        );
        uint256 dealCost = taskPrice * volume;

        // Check current balance
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        uint256 currentBalance = $.m_balances[msg.sender];

        // Calculate how much we need to deposit
        uint256 depositedAmount = 0;
        if (currentBalance < dealCost) {
            uint256 requiredDeposit = dealCost - currentBalance;
            // Perform the token deposit for the exact amount needed
            _depositTokens(msg.sender, requiredDeposit);
            depositedAmount = requiredDeposit;
        }

        // Match the orders with the requester as sponsor
        // Call matchOrders through the interface
        dealId = IexecPoco1(address(this)).matchOrders(
            _apporder,
            _datasetorder,
            _workerpoolorder,
            _requestorder
        );

        return dealId;
    }

    /**
     * @notice Deposit RLC tokens and sponsor match orders for another requester
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
    ) external override returns (bytes32 dealId) {
        // Calculate required deal cost - use the same logic as the original matchOrders
        bool hasDataset = _datasetorder.dataset != address(0);
        uint256 taskPrice = _apporder.appprice +
            (hasDataset ? _datasetorder.datasetprice : 0) +
            _workerpoolorder.workerpoolprice;
        uint256 volume = _computeDealVolume(
            _apporder.volume,
            _toTypedDataHash(_apporder.hash()),
            hasDataset,
            _datasetorder.volume,
            _toTypedDataHash(_datasetorder.hash()),
            _workerpoolorder.volume,
            _toTypedDataHash(_workerpoolorder.hash()),
            _requestorder.volume,
            _toTypedDataHash(_requestorder.hash())
        );
        uint256 dealCost = taskPrice * volume;

        // Check current balance of the sponsor (msg.sender, not the requester)
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        uint256 currentBalance = $.m_balances[msg.sender];

        // Calculate how much we need to deposit
        uint256 depositedAmount = 0;
        if (currentBalance < dealCost) {
            uint256 requiredDeposit = dealCost - currentBalance;
            // Perform the token deposit for the exact amount needed
            _depositTokens(msg.sender, requiredDeposit);
            depositedAmount = requiredDeposit;
        }

        // Match the orders with the caller as sponsor
        dealId = IexecPoco1(address(this)).sponsorMatchOrders(
            _apporder,
            _datasetorder,
            _workerpoolorder,
            _requestorder
        );

        emit DepositAndMatch(msg.sender, depositedAmount, dealId);
        return dealId;
    }

    /**
     * @notice Internal function to handle token deposits
     * @dev This function handles the RLC token transfer and minting
     * @param depositor The account making the deposit
     * @param amount The amount to deposit
     */
    function _depositTokens(address depositor, uint256 amount) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();

        // Transfer RLC tokens from depositor to this contract
        require(
            $.m_baseToken.transferFrom(depositor, address(this), amount),
            "DepositAndMatch: Token transfer failed"
        );

        // Mint equivalent PoCo tokens to depositor
        $.m_balances[depositor] += amount;
        $.m_totalSupply += amount;

        // Emit transfer event for ERC20 compatibility
        emit Transfer(address(0), depositor, amount);
    }
}
