// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;

import "@iexec/interface/contracts/IexecHub.sol";
import "@iexec/solidity/contracts/Libs/SafeMathExtended.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IexecLibCore_v5.sol";
import "./IexecLibOrders_v5.sol";
import "./../registries/apps/App.sol";
import "./../registries/datasets/Dataset.sol";
import "./../registries/workerpools/Workerpool.sol";
import "./../registries/IRegistry.sol";
/****************************************************************************
 * WARNING: Be carefull when editing this file.                             *
 *                                                                          *
 * If you want to add new variables, add them to the end of the             *
 * struct `PocoStorage`.                                                    *
 * Read more about:                                                         *
 *  - Diamond proxy storage https://eips.ethereum.org/EIPS/eip-2535         *
 *  - Namespaced storage https://eips.ethereum.org/EIPS/eip-7201            *
 *                                                                          *
 ****************************************************************************/

library LibPocoStorage {
    // keccak256(abi.encode(uint256(keccak256("iexec.poco.storage.PocoStorage")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant POCO_STORAGE_LOCATION =
        0x5862653c6982c162832160cf30593645e8487b257e44d77cdd6b51eee2651b00;

    /// @custom:storage-location erc7201:iexec.poco.storage.PocoStorage
    struct PocoStorage {
        // Registries
        IRegistry m_appregistry;
        IRegistry m_datasetregistry;
        IRegistry m_workerpoolregistry;
        // Escrow
        IERC20 m_baseToken;
        string m_name;
        string m_symbol;
        uint8 m_decimals;
        uint256 m_totalSupply;
        // In order to use the protocol, users have to deposit RLC
        // and allow PoCo smart contracts to manage them. This state
        // variable keeps track of users balances.
        mapping(address /* account */ => uint256 /* amount */) m_balances;
        // When a deal is created, the protocol temporarily locks an amount
        // of RLC tokens from the balances of both the requester and the workerpool owners.
        // This is to guarantee the payment of different actors later. Frozen funds
        // are released when the computation is completed and the result is pushed.
        mapping(address /* account */ => uint256 /* amount */) m_frozens;
        mapping(address /* owner */ => mapping(address /* spender */ => uint256 /* amount */)) m_allowances;
        // EIP-712 domain hash.
        // Modified in IexecConfigurationFacet.updateDomainSeparator
        bytes32 m_eip712DomainSeparator;
        // Mapping an order hash to its owner. Since a smart contract cannot sign orders
        // with a private key, it adds an entry to this mapping to provide presigned orders.
        mapping(bytes32 /* orderHash */ => address /* owner */) m_presigned;
        // Each order has a volume (>=1). This tracks how much is consumed from
        // the volume of each order. Mapping an order hash to its consumed amount.
        mapping(bytes32 /* orderHash */ => uint256 /* consumedAmount */) m_consumed;
        // a mapping to store PoCo classic deals.
        mapping(bytes32 /* dealId */ => IexecLibCore_v5.Deal) m_deals;
        mapping(bytes32 /* taskId */ => IexecLibCore_v5.Task) m_tasks;
        mapping(bytes32 /* taskId */ => IexecLibCore_v5.Consensus) m_consensus;
        mapping(bytes32 /* taskId */ => mapping(address /* worker */ => IexecLibCore_v5.Contribution)) m_contributions;
        mapping(address /* worker */ => uint256 /* score */) m_workerScores;
        // Poco - Settings
        // Address of a trusted TEE authority that manages enclave challenges.
        // Modified in IexecConfigurationFacet.setTeeBroker
        address m_teebroker;
        // Max amount of gas to be used with callbacks.
        // Modified in IexecConfigurationFacet.setCallbackGas
        uint256 m_callbackgas;
        // List of defined computation categories.
        IexecLibCore_v5.Category[] m_categories;
        // Backward compatibility
        // Modified in IexecConfigurationFacet.configure
        IexecHubInterface m_v3_iexecHub;
        mapping(address /* worker */ => bool) m_v3_scoreImported;
    }

    function getPocoStorage() internal pure returns (PocoStorage storage $) {
        assembly {
            $_slot := POCO_STORAGE_LOCATION
        }
    }
}
