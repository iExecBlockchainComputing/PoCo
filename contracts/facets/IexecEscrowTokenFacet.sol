// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecERC20Core} from "./IexecERC20Core.sol";
import {FacetBase} from "./FacetBase.sol";
import {IexecEscrowToken} from "../interfaces/IexecEscrowToken.sol";
import {IexecTokenSpender} from "../interfaces/IexecTokenSpender.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
import {IexecPoco1} from "../interfaces/IexecPoco1.sol";
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

contract IexecEscrowTokenFacet is IexecEscrowToken, IexecTokenSpender, FacetBase, IexecERC20Core {

    /***************************************************************************
     *                         Escrow methods: public                          *
     ***************************************************************************/
    receive() external payable override {
        revert("fallback-disabled");
    }

    fallback() external payable override {
        revert("fallback-disabled");
    }

    function deposit(uint256 amount) external override returns (bool) {
        _deposit(_msgSender(), amount);
        _mint(_msgSender(), amount);
        return true;
    }

    function depositFor(uint256 amount, address target) external override returns (bool) {
        _deposit(_msgSender(), amount);
        _mint(target, amount);
        return true;
    }

    function depositForArray(
        uint256[] calldata amounts,
        address[] calldata targets
    ) external override returns (bool) {
        require(amounts.length == targets.length, "invalid-array-length");
        for (uint i = 0; i < amounts.length; ++i) {
            _deposit(_msgSender(), amounts[i]);
            _mint(targets[i], amounts[i]);
        }
        return true;
    }

    function withdraw(uint256 amount) external override returns (bool) {
        _burn(_msgSender(), amount);
        _withdraw(_msgSender(), amount);
        return true;
    }

    function withdrawTo(uint256 amount, address target) external override returns (bool) {
        _burn(_msgSender(), amount);
        _withdraw(target, amount);
        return true;
    }

    function recover() external override onlyOwner returns (uint256) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        uint256 delta = $.m_baseToken.balanceOf(address(this)) - $.m_totalSupply;
        _mint(owner(), delta);
        return delta;
    }

    // Token Spender (endpoint for approveAndCallback calls to the proxy)
    function receiveApproval(
        address sender,
        uint256 amount,
        address token,
        bytes calldata data
    ) external returns (bool) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        require(token == address($.m_baseToken), "wrong-token");
        _deposit(sender, amount);
        _mint(sender, amount);
        if (data.length > 0) {
            // (bool success, bytes memory result) = address(this).call(data);
            (
                IexecLibOrders_v5.AppOrder memory apporder,
                IexecLibOrders_v5.DatasetOrder memory datasetorder,
                IexecLibOrders_v5.WorkerpoolOrder memory workerpoolorder,
                IexecLibOrders_v5.RequestOrder memory requestorder
            ) = abi.decode(
                data,
                (
                    IexecLibOrders_v5.AppOrder,
                    IexecLibOrders_v5.DatasetOrder,
                    IexecLibOrders_v5.WorkerpoolOrder,
                    IexecLibOrders_v5.RequestOrder
                )
            );
            workerpoolorder;
            requestorder;
            emit IexecPoco1.Called(apporder.app, datasetorder.dataset);
            // (bool success, bytes memory result) = address(this).call(
            //     abi.encodeWithSelector(
            //         IexecPoco1.matchOrders.selector,
            //         apporder,
            //         datasetorder,
            //         workerpoolorder,
            //         requestorder
            //     )
            // );
            // // Bubble up the original revert reason if the call failed
            // if (!success) {
            //     if (result.length > 0) {
            //         // Decode revert reason and revert with it
            //         assembly {
            //             let returndata_size := mload(result)
            //             revert(add(result, 32), returndata_size)
            //         }
            //     } else {
            //         revert("receive-approval-failed");
            //     }
            // }
        }

        return true;
    }

    function _deposit(address from, uint256 amount) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        require($.m_baseToken.transferFrom(from, address(this), amount), "failled-transferFrom");
    }

    function _withdraw(address to, uint256 amount) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_baseToken.transfer(to, amount);
    }
}
