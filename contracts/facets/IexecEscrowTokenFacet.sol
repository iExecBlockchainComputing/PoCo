// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecERC20Base} from "../abstract/IexecERC20Base.sol";
import {IexecEscrowToken} from "../interfaces/IexecEscrowToken.sol";
import {IexecTokenSpender} from "../interfaces/IexecTokenSpender.sol";
import {IexecPoco1} from "../interfaces/IexecPoco1.sol";
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";

contract IexecEscrowTokenFacet is IexecEscrowToken, IexecTokenSpender, IexecERC20Base {
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
     *            Token Spender: Atomic Deposit + Match                        *
     ***************************************************************************/

    /**
     * @notice Receives approval, deposit and optionally executes a supported operation in one transaction.
     *
     * Usage patterns:
     * 1. Simple deposit: RLC.approveAndCall(escrow, amount, "")
     * 2. Deposit + operation: RLC.approveAndCall(escrow, amount, encodedOperation)
     *
     * The `data` parameter should include a function selector (first 4 bytes) to identify
     * the operation, followed by ABI-encoded parameters. Supported operations:
     * - matchOrders: Validates sender is requester, then matches orders
     *
     * @dev Implementation details:
     * - Deposits tokens first, then executes the operation if data is provided
     * - Extracts function selector from data to determine the operation
     * - Each operation has a validator (_validateMatchOrders, etc.) to check preconditions
     * - After validation, _executeOperation performs the delegatecall
     * - Error handling is generalized: reverts are bubbled up with revert reasons or the message 'operation-failed'
     * - Future operations can be added by implementing a validator and adding a selector case
     *
     * @dev matchOrders specific notes:
     * - Sponsoring is NOT supported. The requester (specified in the request order) always pays for the deal.
     * - Clients must compute the exact deal cost and deposit the right amount.
     *   The deal cost = (appPrice + datasetPrice + workerpoolPrice) * volume.
     *
     * @param sender The address that approved tokens
     * @param amount Amount of tokens approved and to be deposited
     * @param token Address of the token (must be RLC)
     * @param data Optional: Function selector + ABI-encoded parameters
     * @return success True if operation succeeded
     *
     *
     * @custom:example
     * ```solidity
     * // Compute deal cost
     * uint256 dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
     *
     * // Encode matchOrders operation with selector
     * bytes memory data = abi.encodeWithSelector(
     *     IexecPoco1.matchOrders.selector,
     *     appOrder,
     *     datasetOrder,
     *     workerpoolOrder,
     *     requestOrder
     * );
     *
     * // Call the RLC contract with the encoded data.
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

    /**
     * Executes a supported operation after depositing tokens.
     * @param sender The address that approved tokens and initiated the operation
     * @param data ABI-encoded function selector and parameters of the operation
     */
    function _executeOperation(address sender, bytes calldata data) internal {
        // Extract the function selector (first 4 bytes)
        bytes4 selector = bytes4(data[:4]);
        // Validate operation-specific preconditions before execution
        if (selector == IexecPoco1.matchOrders.selector) {
            _validateMatchOrders(sender, data);
        } else {
            revert("unsupported-operation");
        }
        // Execute the operation via delegatecall
        // This preserves `msg.sender` context and allows the operation to access
        // the diamond's storage and functions.
        // Note: here `msg.sender` is the RLC token contract.
        (bool success, bytes memory result) = address(this).delegatecall(data);
        if (success) {
            return;
        }
        // Handle failure and bubble up revert reason
        if (result.length == 0) {
            revert("operation-failed");
        }
        // Decode and revert with the original error
        assembly {
            let returndata_size := mload(result)
            revert(add(result, 32), returndata_size)
        }
    }

    /**
     * @dev Validates matchOrders preconditions
     * @param sender The user who deposited (must be the requester)
     * @param data matchOrders calldata
     */
    function _validateMatchOrders(address sender, bytes calldata data) internal pure {
        // Decode orders and check that the sender is the requester.
        (, , , IexecLibOrders_v5.RequestOrder memory requestorder) = abi.decode(
            data[4:],
            (
                IexecLibOrders_v5.AppOrder,
                IexecLibOrders_v5.DatasetOrder,
                IexecLibOrders_v5.WorkerpoolOrder,
                IexecLibOrders_v5.RequestOrder
            )
        );
        if (requestorder.requester != sender) {
            revert("caller-must-be-requester");
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
