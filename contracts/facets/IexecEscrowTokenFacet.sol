// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecERC20Core} from "./IexecERC20Core.sol";
import {FacetBase} from "./FacetBase.sol";
import {IexecEscrowToken} from "../interfaces/IexecEscrowToken.sol";
import {IexecTokenSpender} from "../interfaces/IexecTokenSpender.sol";
import {IexecPoco1} from "../interfaces/IexecPoco1.sol";
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";

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

    /***************************************************************************
     *            Token Spender: Atomic Deposit+Match                  *
     ***************************************************************************/

    /**
     * @notice Receives approval, deposit and optionally matches orders in one transaction
     *
     * Usage patterns:
     * 1. Simple deposit: RLC.approveAndCall(escrow, amount, "")
     * 2. Deposit + match: RLC.approveAndCall(escrow, amount, encodedOrders)
     *
     * The `data` parameter should be ABI-encoded orders if matching is desired:
     * abi.encode(appOrder, datasetOrder, workerpoolOrder, requestOrder)
     *
     * @dev Important notes:
     * - Match orders sponsoring is NOT supported. The requester (sender) always pays for the deal.
     * - Clients must compute the exact deal cost and deposit the right amount for the deal to be matched.
     *   The deal cost = (appPrice + datasetPrice + workerpoolPrice) * volume.
     * - If insufficient funds are deposited, the match will fail.
     *
     * @param sender The address that approved tokens (must be requester if matching)
     * @param amount Amount of tokens approved and to be deposited
     * @param token Address of the token (must be RLC)
     * @param data Optional: ABI-encoded orders for matching
     * @return success True if operation succeeded
     *
     *
     * @custom:example
     * ```solidity
     * // Compute deal cost
     * uint256 dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
     *
     * // Encode orders
     * bytes memory data = abi.encodeWithSelector(
     *     IexecPoco1.matchOrders.selector,
     *     appOrder,
     *     datasetOrder,
     *     workerpoolOrder,
     *     requestOrder
     * );
     *
     * // One transaction does it all
     * RLC(token).approveAndCall(iexecProxy, dealCost, data);
     * ```
     */
    function receiveApproval(
        address sender,
        uint256 amount,
        address token,
        bytes calldata data
    ) external override returns (bool) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        require(token == address($.m_baseToken), "wrong-token");
        _deposit(sender, amount);
        _mint(sender, amount);

        if (data.length > 0) {
            _executeOperation(sender, data);
        }
        return true;
    }

    function _executeOperation(address sender, bytes calldata data) internal {
        // Extract the function selector (first 4 bytes)
        bytes4 selector = bytes4(data[:4]);

        // Check which operation to execute
        if (selector == IexecPoco1.matchOrders.selector) {
            _executeMatchOrders(sender, data);
        } else {
            revert("unsupported-operation");
        }
    }

    /******************************************************************************
     *        Token Spender: Atomic Deposit+Match if used with RLC.approveAndCall *
     *****************************************************************************/

    /**
     * @dev Internal function to matchOrders after deposit
     * @param sender The user who deposited (must be the requester)
     * @param data ABI-encoded orders
     */
    function _executeMatchOrders(address sender, bytes calldata data) internal {
        // Decode only the request order to validate the requester
        // Full decoding: (AppOrder, DatasetOrder, WorkerpoolOrder, RequestOrder)
        // We only need to check requestorder.requester
        (, , , IexecLibOrders_v5.RequestOrder memory requestorder) = abi.decode(
            data[4:],
            (
                IexecLibOrders_v5.AppOrder,
                IexecLibOrders_v5.DatasetOrder,
                IexecLibOrders_v5.WorkerpoolOrder,
                IexecLibOrders_v5.RequestOrder
            )
        );

        // Validate that sender is the requester
        if (requestorder.requester != sender) revert("caller-must-be-requester");

        // Call matchOrders on the IexecPoco1 facet through the diamond
        // Using delegatecall for safety: preserves msg.sender context
        // Note: matchOrders doesn't use msg.sender, but delegatecall is safer
        // in case the implementation changes in the future
        (bool success, bytes memory result) = address(this).delegatecall(data);

        // Handle failure and bubble up revert reason
        if (!success) {
            if (result.length > 0) {
                // Decode and revert with the original error
                assembly {
                    let returndata_size := mload(result)
                    revert(add(result, 32), returndata_size)
                }
            } else {
                revert("match-orders-failed");
            }
        }
    }

    function _deposit(address from, uint256 amount) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        require($.m_baseToken.transferFrom(from, address(this), amount), "failed-transferFrom");
    }

    function _withdraw(address to, uint256 amount) internal {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_baseToken.transfer(to, amount);
    }
}
