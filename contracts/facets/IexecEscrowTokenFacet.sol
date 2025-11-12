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
     * @notice Receives approval, deposit and optionally executes an operation in one transaction
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
     * - Extracts function selector from data to determine which operation
     * - Each operation has a validator (_validateMatchOrders, etc.) for preconditions
     * - After validation, _executeOperation performs the delegatecall
     * - Error handling is generalized: bubbles up revert reasons or returns 'operation-failed'
     * - Future operations can be added by implementing a validator and adding a selector case
     *
     * @dev matchOrders specific notes:
     * - Sponsoring is NOT supported. The requester (sender) always pays for the deal.
     * - Clients must compute the exact deal cost and deposit the right amount.
     *   The deal cost = (appPrice + datasetPrice + workerpoolPrice) * volume.
     *
     * @param sender The address that approved tokens
     * @param amount Amount of tokens approved and to be deposited
     * @param token Address of the token (must be RLC)
     * @param data Optional: Function selector + ABI-encoded parameters for operation
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
     * // One transaction does it all: approve, deposit, and match
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

        // Validate operation-specific preconditions before execution
        if (selector == IexecPoco1.matchOrders.selector) {
            _validateMatchOrders(sender, data);
        } else {
            revert("unsupported-operation");
        }

        // Execute the operation via delegatecall
        // This preserves msg.sender context and allows the operation to access
        // the diamond's storage and functions
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
                revert("operation-failed");
            }
        }
    }

    /******************************************************************************
     *        Token Spender: Atomic Deposit+Match if used with RLC.approveAndCall *
     *****************************************************************************/

    /**
     * @dev Validates matchOrders preconditions
     * @param sender The user who deposited (must be the requester)
     * @param data ABI-encoded matchOrders call with orders
     *
     * Gas-optimized implementation using assembly to extract only the requester field
     * without decoding all four order structs. This saves approximately:
     * - ~36 gas minimum
     * - ~9,260 gas maximum
     * - ~4,243 gas average (~1% improvement)
     * compared to using abi.decode on all four orders.
     *
     * Calldata structure for matchOrders(AppOrder, DatasetOrder, WorkerpoolOrder, RequestOrder):
     * - 0x00-0x03: Function selector (4 bytes)
     * - 0x04-0x23: Offset to AppOrder (32 bytes, points to 0x80)
     * - 0x24-0x43: Offset to DatasetOrder (32 bytes, points to dynamic position)
     * - 0x44-0x63: Offset to WorkerpoolOrder (32 bytes, points to dynamic position)
     * - 0x64-0x83: Offset to RequestOrder (32 bytes, points to dynamic position)
     * - Then the actual struct data follows...
     *
     * RequestOrder fields (in order):
     * 0: app, 1: appmaxprice, 2: dataset, 3: datasetmaxprice, 4: workerpool,
     * 5: workerpoolmaxprice, 6: requester, 7: volume, 8: tag, 9: category,
     * 10: trust, 11: beneficiary, 12: callback, 13: params (dynamic), 14: salt, 15: sign (dynamic)
     *
     * The requester is the 7th field (index 6) in the RequestOrder struct.
     */
    function _validateMatchOrders(address sender, bytes calldata data) internal pure {
        assembly {
            // Read the offset to RequestOrder (4th parameter, at position 0x64 after selector)
            // data.offset points to the start of data in calldata
            // We need: data.offset + 4 (skip selector) + 0x60 (skip 3 offsets of 32 bytes each)
            let requestOrderOffsetPtr := add(data.offset, 0x64)
            let requestOrderOffset := calldataload(requestOrderOffsetPtr)

            // The offset is relative to the start of the parameters (after selector)
            // So we add 4 (selector size) to get the absolute position
            // Then we need to skip to the 7th field (requester) which is at:
            // - 0x00: offset marker (we're already here)
            // - 0x00-0x1F: app (field 0)
            // - 0x20-0x3F: appmaxprice (field 1)
            // - 0x40-0x5F: dataset (field 2)
            // - 0x60-0x7F: datasetmaxprice (field 3)
            // - 0x80-0x9F: workerpool (field 4)
            // - 0xA0-0xBF: workerpoolmaxprice (field 5)
            // - 0xC0-0xDF: requester (field 6) ← This is what we want
            let requesterOffset := add(add(data.offset, 0x04), add(requestOrderOffset, 0xC0))
            let requester := calldataload(requesterOffset)

            // Clean the address (addresses are 20 bytes, stored in 32 bytes with leading zeros)
            requester := and(requester, 0xffffffffffffffffffffffffffffffffffffffff)

            // Compare requester with sender
            if iszero(eq(requester, sender)) {
                // Revert with "caller-must-be-requester"
                // Error selector for Error(string): 0x08c379a0
                mstore(0x00, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(0x04, 0x0000000000000000000000000000000000000000000000000000000000000020)
                mstore(0x24, 0x0000000000000000000000000000000000000000000000000000000000000018) // length: 24
                // "caller-must-be-requester" in hex (24 bytes)
                mstore(0x44, 0x63616c6c65722d6d7573742d62652d7265717565737465720000000000000000)
                revert(0x00, 0x64)
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
