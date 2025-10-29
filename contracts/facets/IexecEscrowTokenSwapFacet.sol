// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecERC20Core} from "./IexecERC20Core.sol";
import {SignatureVerifier} from "./SignatureVerifier.v8.sol";
import {FacetBase} from "./FacetBase.v8.sol";
import {IexecEscrowTokenSwap} from "../interfaces/IexecEscrowTokenSwap.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.v8.sol";
import {IexecPoco1} from "../interfaces/IexecPoco1.sol";
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IexecPocoCommon} from "./IexecPocoCommon.sol";

contract IexecEscrowTokenSwapFacet is
    IexecEscrowTokenSwap,
    FacetBase,
    IexecERC20Core,
    SignatureVerifier,
    IexecPocoCommon
{
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

    IUniswapV2Router02 internal constant router =
        IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    /***************************************************************************
     *                                Accessor                                 *
     ***************************************************************************/
    function UniswapV2Router() external view override returns (IUniswapV2Router02) {
        return router;
    }

    /***************************************************************************
     *                         Uniswap path - Internal                         *
     ***************************************************************************/
    function _eth2token() internal view returns (address[] memory path) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        path = new address[](2);
        path[0] = router.WETH();
        path[1] = address($.m_baseToken);
    }

    function _token2eth() internal view returns (address[] memory path) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        path = new address[](2);
        path[0] = address($.m_baseToken);
        path[1] = router.WETH();
    }

    /***************************************************************************
     *                       Prediction methods - Public                       *
     ***************************************************************************/
    function estimateDepositEthSent(uint256 eth) external view override returns (uint256 token) {
        return router.getAmountsOut(eth, _eth2token())[1];
    }
    function estimateDepositTokenWanted(
        uint256 token
    ) external view override returns (uint256 eth) {
        return router.getAmountsIn(token, _eth2token())[0];
    }
    function estimateWithdrawTokenSent(uint256 token) external view override returns (uint256 eth) {
        return router.getAmountsOut(token, _token2eth())[1];
    }
    function estimateWithdrawEthWanted(uint256 eth) external view override returns (uint256 token) {
        return router.getAmountsIn(eth, _token2eth())[0];
    }

    /***************************************************************************
     *                        Swapping methods - Public                        *
     ***************************************************************************/
    receive() external payable override {
        address sender = _msgSender();
        if (sender != address(router)) {
            _deposit(sender, msg.value, 0);
        }
    }

    fallback() external payable override {
        revert("fallback-disabled");
    }

    function depositEth() external payable override {
        _deposit(_msgSender(), msg.value, 0);
    }
    function depositEthFor(address target) external payable override {
        _deposit(target, msg.value, 0);
    }
    function safeDepositEth(uint256 minimum) external payable override {
        _deposit(_msgSender(), msg.value, minimum);
    }
    function safeDepositEthFor(uint256 minimum, address target) external payable override {
        _deposit(target, msg.value, minimum);
    }
    function requestToken(uint256 amount) external payable override {
        _request(_msgSender(), msg.value, amount);
    }
    function requestTokenFor(uint256 amount, address target) external payable override {
        _request(target, msg.value, amount);
    }
    function withdrawEth(uint256 amount) external override {
        _withdraw(_msgSender(), amount, 0);
    }
    function withdrawEthTo(uint256 amount, address target) external override {
        _withdraw(target, amount, 0);
    }
    function safeWithdrawEth(uint256 amount, uint256 minimum) external override {
        _withdraw(_msgSender(), amount, minimum);
    }
    function safeWithdrawEthTo(uint256 amount, uint256 minimum, address target) external override {
        _withdraw(target, amount, minimum);
    }

    /***************************************************************************
     *                       Swapping methods - Internal                       *
     ***************************************************************************/
    function _deposit(address target, uint256 value, uint256 minimum) internal {
        uint256[] memory amounts = router.swapExactETHForTokens{value: value}(
            minimum,
            _eth2token(),
            address(this),
            block.timestamp + 1
        );
        _mint(target, amounts[1]);
    }

    function _request(address target, uint256 value, uint256 amount) internal {
        uint256[] memory amounts = router.swapETHForExactTokens{value: value}(
            amount,
            _eth2token(),
            address(this),
            block.timestamp + 1
        );
        _mint(target, amounts[1]);
        uint256 refund = value - amounts[0];
        if (refund > 0) {
            (bool success, ) = _msgSender().call{value: refund}("");
            require(success, "native-transfer-failed");
        }
    }

    function _withdraw(address target, uint256 amount, uint256 minimum) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_baseToken.approve(address(router), amount);
        uint256[] memory amounts = router.swapExactTokensForETH(
            amount,
            minimum,
            _token2eth(),
            target,
            block.timestamp + 1
        );
        _burn(_msgSender(), amounts[0]);
    }

    /***************************************************************************
     *                          Extra public methods                           *
     ***************************************************************************/
    function matchOrdersWithEth(
        IexecLibOrders_v5.AppOrder memory _apporder,
        IexecLibOrders_v5.DatasetOrder memory _datasetorder,
        IexecLibOrders_v5.WorkerpoolOrder memory _workerpoolorder,
        IexecLibOrders_v5.RequestOrder memory _requestorder
    ) public payable override returns (bytes32) {
        // Calculate remaining volume for each order
        // volume = min(appVolume, datasetVolume, workerpoolVolume, requestVolume)
        bool hasDataset = _datasetorder.dataset != address(0);
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
        // Calculate total cost
        // cost = (appPrice + datasetPrice + workerpoolPrice) * volume
        uint256 totalCost = (_apporder.appprice +
            (hasDataset ? _datasetorder.datasetprice : 0) +
            _workerpoolorder.workerpoolprice) * volume;

        // Request exact tokens needed, refund excess ETH
        _request(_requestorder.requester, msg.value, totalCost);

        // Match orders using PoCo facet
        return
            IexecPoco1(address(this)).matchOrders(
                _apporder,
                _datasetorder,
                _workerpoolorder,
                _requestorder
            );
    }
}
