// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts-v5/interfaces/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts-v5/interfaces/IERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts-v5/access/Ownable.sol";
import {IexecLibCore_v5} from "./libs/IexecLibCore_v5.sol";

/****************************************************************************
 * WARNING: Be carefull when editing this file.                             *
 *                                                                          *
 * If you want add new variables for expanded features, add them at the     *
 * end, or (better?) create a Store_v2 that inherits from this Store.       *
 *                                                                          *
 * If in doubt, read about ERC1538 memory store.                            *
 ****************************************************************************/

/// @dev Solstruct translation for v0.8.0
library LibSet_bytes4 {
    struct set {
        bytes4[] values;
        mapping(bytes4 => uint256) indexes;
    }
}

library LibMap2_bytes4_address_bytes {
    struct map {
        LibSet_bytes4.set keyset;
        mapping(bytes4 => address) values1;
        mapping(bytes4 => bytes) values2;
    }
}

/// @dev @iexec/solidity ERC1538
abstract contract ERC1538Store is Ownable {
    LibMap2_bytes4_address_bytes.map internal m_funcs;
}

/// @dev registries
interface IRegistry is IERC721Enumerable {
    function isRegistered(address _entry) external view returns (bool);
}

/// @dev Poco store
/**
 * @title Central storage of all modules contracts. It follows the transparent
 * contract standard aka ERC-1538.
 * @dev note the new added state variable "m_dealsBoost" that holds a new type
 * of deals for the PoCo Boost workflow.
 */
abstract contract Store is ERC1538Store {
    // Registries
    //slither-disable-next-line constable-states
    IRegistry internal m_appregistry;
    //slither-disable-next-line constable-states
    IRegistry internal m_datasetregistry;
    //slither-disable-next-line constable-states
    IRegistry internal m_workerpoolregistry;

    // Escrow
    //slither-disable-next-line constable-states
    IERC20 internal m_baseToken;
    //slither-disable-next-line constable-states
    string internal m_name;
    //slither-disable-next-line constable-states
    string internal m_symbol;
    //slither-disable-next-line constable-states
    uint8 internal m_decimals;
    //slither-disable-next-line constable-states
    uint256 internal m_totalSupply;

    /**
     * @dev In order to use the protocol, users have to deposit RLC
     * and allow PoCo smart contracts to manage them. This state
     * variable keeps track of users balances.
     */
    mapping(address => uint256) internal m_balances;

    /**
     * @dev When a deal is created, the protocol temporarily locks an amount
     * of RLC tokens from the balances of both the requester and the workerpool owners.
     * This is to guarantee the payment of different actors later. Frozen funds
     * are released when the computation is completed and the result is pushed.
     */
    mapping(address => uint256) internal m_frozens;

    mapping(address => mapping(address => uint256)) internal m_allowances;

    // Poco - Constants
    uint256 internal constant CONTRIBUTION_DEADLINE_RATIO = 7;
    uint256 internal constant REVEAL_DEADLINE_RATIO = 2;
    uint256 internal constant FINAL_DEADLINE_RATIO = 10;
    uint256 internal constant WORKERPOOL_STAKE_RATIO = 30;
    uint256 internal constant KITTY_RATIO = 10;
    uint256 internal constant KITTY_MIN = 1e9; // ADJUSTEMENT VARIABLE

    /**
     * @dev Seized funds of workerpools that do not honor their deals are sent
     * out to this kitty address.
     * It is determined with address(uint256(keccak256(bytes('iExecKitty'))) - 1).
     */
    address internal constant KITTY_ADDRESS = 0x99c2268479b93fDe36232351229815DF80837e23;

    /**
     * @dev Used with ERC-734 Key Manager identity contract for authorization management.
     */
    uint256 internal constant GROUPMEMBER_PURPOSE = 4;

    /**
     * @dev EIP-712 domain hash.
     */
    // Modified in IexecMaintenanceDelegate.updateDomainSeparator
    //slither-disable-next-line constable-states
    bytes32 internal EIP712DOMAIN_SEPARATOR;

    // Poco - Storage

    /**
     * @dev Mapping an order hash to its owner. Since a smart contract cannot sign orders
     * with a private key, it adds an entry to this mapping to provide presigned orders.
     */
    mapping(bytes32 => address) internal m_presigned;

    /**
     * @dev Each order has a volume (>=1). This tracks how much is consumed from
     * the volume of each order. Mapping an order hash to its consumed amount.
     */
    mapping(bytes32 => uint256) internal m_consumed;

    /**
     * @dev a mapping to store PoCo classic deals.
     */
    mapping(bytes32 => IexecLibCore_v5.Deal) internal m_deals;

    mapping(bytes32 => IexecLibCore_v5.Task) internal m_tasks; // per task
    mapping(bytes32 => IexecLibCore_v5.Consensus) internal m_consensus; // per task
    mapping(bytes32 => mapping(address => IexecLibCore_v5.Contribution)) internal m_contributions; // per task-worker
    mapping(address => uint256) internal m_workerScores; // per worker

    // Poco - Settings

    /**
     * @dev Address of a trusted TEE authority that manages enclave challenges.
     */
    // Modified in IexecMaintenanceDelegate.setTeeBroker
    //slither-disable-next-line constable-states
    address internal m_teebroker;

    /**
     * @dev Max amount of gas to be used with callbacks.
     */
    // Modified in IexecMaintenanceDelegate.setCallbackGas
    //slither-disable-next-line constable-states
    uint256 internal m_callbackgas;

    /**
     * @dev List of defined computation categories.
     */
    IexecLibCore_v5.Category[] internal m_categories;

    // Backward compatibility
    // Modified in IexecMaintenanceDelegate.configure
    //slither-disable-next-line constable-states
    address internal m_v3_iexecHub; // IexecHubInterface
    mapping(address => bool) internal m_v3_scoreImported;

    /**
     * @dev A mapping to store PoCo Boost deals.
     */
    mapping(bytes32 => IexecLibCore_v5.DealBoost) internal m_dealsBoost;
    IRegistry internal m_datapoolRegistry;
}
