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
 * If in doubt, read about Diamond proxy storage.                           *
 ****************************************************************************/

abstract contract Store {
    // Poco - Constants
    uint256 public constant CONTRIBUTION_DEADLINE_RATIO = 7;
    uint256 public constant REVEAL_DEADLINE_RATIO = 2;
    uint256 public constant FINAL_DEADLINE_RATIO = 10;
    uint256 public constant WORKERPOOL_STAKE_RATIO = 30;
    uint256 public constant KITTY_RATIO = 10;
    uint256 public constant KITTY_MIN = 1e9; // ADJUSTEMENT VARIABLE

    /**
     * @dev Seized funds of workerpools that do not honor their deals are sent
     * out to this kitty address.
     * It is determined with address(uint256(keccak256(bytes('iExecKitty'))) - 1).
     */
    address public constant KITTY_ADDRESS = 0x99c2268479b93fDe36232351229815DF80837e23;

    /**
     * @dev Used with ERC-734 Key Manager identity contract for authorization management.
     */
    uint256 public constant GROUPMEMBER_PURPOSE = 4;

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

        /**
         * @dev In order to use the protocol, users have to deposit RLC
         * and allow PoCo smart contracts to manage them. This state
         * variable keeps track of users balances.
         */
        mapping(address => uint256) m_balances;

        /**
         * @dev When a deal is created, the protocol temporarily locks an amount
         * of RLC tokens from the balances of both the requester and the workerpool owners.
         * This is to guarantee the payment of different actors later. Frozen funds
         * are released when the computation is completed and the result is pushed.
         */
        mapping(address => uint256) m_frozens;

        mapping(address => mapping(address => uint256)) m_allowances;

        /**
         * @dev EIP-712 domain hash.
         */
        // Modified in IexecConfigurationFacet.updateDomainSeparator
        bytes32 EIP712DOMAIN_SEPARATOR;

        // Poco - Storage

        /**
         * @dev Mapping an order hash to its owner. Since a smart contract cannot sign orders
         * with a private key, it adds an entry to this mapping to provide presigned orders.
         */
        mapping(bytes32 => address) m_presigned;

        /**
         * @dev Each order has a volume (>=1). This tracks how much is consumed from
         * the volume of each order. Mapping an order hash to its consumed amount.
         */
        mapping(bytes32 => uint256) m_consumed;

        /**
         * @dev a mapping to store PoCo classic deals.
         */
        mapping(bytes32 => IexecLibCore_v5.Deal) m_deals;

        mapping(bytes32 => IexecLibCore_v5.Task) m_tasks; // per task
        mapping(bytes32 => IexecLibCore_v5.Consensus) m_consensus; // per task
        mapping(bytes32 => mapping(address => IexecLibCore_v5.Contribution)) m_contributions; // per task-worker
        mapping(address => uint256) m_workerScores; // per worker

        // Poco - Settings

        /**
         * @dev Address of a trusted TEE authority that manages enclave challenges.
         */
        // Modified in IexecConfigurationFacet.setTeeBroker
        address m_teebroker;

        /**
         * @dev Max amount of gas to be used with callbacks.
         */
        // Modified in IexecConfigurationFacet.setCallbackGas
        uint256 m_callbackgas;

        /**
         * @dev List of defined computation categories.
         */
        IexecLibCore_v5.Category[] m_categories;

        // Backward compatibility
        // Modified in IexecConfigurationFacet.configure
        address m_v3_iexecHub; // IexecHubInterface
        mapping(address => bool) m_v3_scoreImported;

        /**
         * @dev A mapping to store PoCo Boost deals.
         */
        mapping(bytes32 => IexecLibCore_v5.DealBoost) m_dealsBoost;
    }

    function getPocoStorage() internal pure returns (PocoStorage storage $) {
        assembly ("memory-safe") {
            $.slot := POCO_STORAGE_LOCATION
        }
    }
}

interface IRegistry is IERC721Enumerable {
    function isRegistered(address _entry) external view returns (bool);
}
