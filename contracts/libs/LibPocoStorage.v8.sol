// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts-v5/interfaces/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts-v5/interfaces/IERC721Enumerable.sol";
import {IexecLibCore_v5} from "./IexecLibCore_v5.sol";

/**
 * @title LibPocoStorage
 * @dev Library for managing PoCo diamond storage using ERC-7201 namespaced storage pattern.
 * This library replaces the Store abstract contract to support ERC-2535 diamond proxy architecture.
 */
library LibPocoStorage {
    // Poco - Constants
    uint256 internal constant CONTRIBUTION_DEADLINE_RATIO = 7;
    uint256 internal constant REVEAL_DEADLINE_RATIO = 2;
    uint256 internal constant FINAL_DEADLINE_RATIO = 10;
    uint256 internal constant WORKERPOOL_STAKE_RATIO = 30;
    uint256 internal constant KITTY_RATIO = 10;
    uint256 internal constant KITTY_MIN = 1e9; // ADJUSTEMENT VARIABLE

    // Seized funds of workerpools that do not honor their deals are sent
    // out to this kitty address.
    // It is determined with address(uint256(keccak256(bytes('iExecKitty'))) - 1).
    address internal constant KITTY_ADDRESS = 0x99c2268479b93fDe36232351229815DF80837e23;

    // Used with ERC-734 Key Manager identity contract for authorization management.
    uint256 internal constant GROUPMEMBER_PURPOSE = 4;

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
        address m_v3_iexecHub; // IexecHubInterface
        mapping(address /* worker */ => bool) m_v3_scoreImported;
        // /!\ New storage variables not present in v6 store.
        // A mapping to store PoCo Boost deals.
        mapping(bytes32 /* dealId */ => IexecLibCore_v5.DealBoost) m_dealsBoost;
    }

    /**
     * @dev Returns the storage pointer for PocoStorage.
     * @return $ The storage pointer to PocoStorage struct.
     */
    function getPocoStorage() internal pure returns (PocoStorage storage $) {
        assembly ("memory-safe") {
            $.slot := POCO_STORAGE_LOCATION
        }
    }

    // === Constants Getter Functions ===
    function getContributionDeadlineRatio() internal pure returns (uint256) {
        return CONTRIBUTION_DEADLINE_RATIO;
    }

    function getRevealDeadlineRatio() internal pure returns (uint256) {
        return REVEAL_DEADLINE_RATIO;
    }

    function getFinalDeadlineRatio() internal pure returns (uint256) {
        return FINAL_DEADLINE_RATIO;
    }

    function getWorkerpoolStakeRatio() internal pure returns (uint256) {
        return WORKERPOOL_STAKE_RATIO;
    }

    function getKittyRatio() internal pure returns (uint256) {
        return KITTY_RATIO;
    }

    function getKittyMin() internal pure returns (uint256) {
        return KITTY_MIN;
    }

    function getKittyAddress() internal pure returns (address) {
        return KITTY_ADDRESS;
    }

    function getGroupmemberPurpose() internal pure returns (uint256) {
        return GROUPMEMBER_PURPOSE;
    }

    // === Storage Getter Functions ===

    /**
     * @dev Get the app registry contract.
     * @return The app registry contract interface.
     */
    function appRegistry() internal view returns (IRegistry) {
        return getPocoStorage().m_appregistry;
    }

    /**
     * @dev Get the dataset registry contract.
     * @return The dataset registry contract interface.
     */
    function datasetRegistry() internal view returns (IRegistry) {
        return getPocoStorage().m_datasetregistry;
    }

    /**
     * @dev Get the workerpool registry contract.
     * @return The workerpool registry contract interface.
     */
    function workerpoolRegistry() internal view returns (IRegistry) {
        return getPocoStorage().m_workerpoolregistry;
    }

    /**
     * @dev Get the base token contract.
     * @return The base token contract interface.
     */
    function baseToken() internal view returns (IERC20) {
        return getPocoStorage().m_baseToken;
    }

    /**
     * @dev Get the token name.
     * @return The token name string.
     */
    function name() internal view returns (string storage) {
        return getPocoStorage().m_name;
    }

    /**
     * @dev Get the token symbol.
     * @return The token symbol string.
     */
    function symbol() internal view returns (string storage) {
        return getPocoStorage().m_symbol;
    }

    /**
     * @dev Get the token decimals.
     * @return The token decimals.
     */
    function decimals() internal view returns (uint8) {
        return getPocoStorage().m_decimals;
    }

    /**
     * @dev Get the total supply.
     * @return The total supply amount.
     */
    function totalSupply() internal view returns (uint256) {
        return getPocoStorage().m_totalSupply;
    }

    /**
     * @dev Get the balance of an account.
     * @param account The account address.
     * @return The balance amount.
     */
    function balanceOf(address account) internal view returns (uint256) {
        return getPocoStorage().m_balances[account];
    }

    /**
     * @dev Get the frozen balance of an account.
     * @param account The account address.
     * @return The frozen balance amount.
     */
    function frozenOf(address account) internal view returns (uint256) {
        return getPocoStorage().m_frozens[account];
    }

    /**
     * @dev Get the allowance amount.
     * @param owner The owner address.
     * @param spender The spender address.
     * @return The allowance amount.
     */
    function allowance(address owner, address spender) internal view returns (uint256) {
        return getPocoStorage().m_allowances[owner][spender];
    }

    /**
     * @dev Get the EIP712 domain separator.
     * @return The domain separator hash.
     */
    function domainSeparator() internal view returns (bytes32) {
        return getPocoStorage().m_eip712DomainSeparator;
    }

    /**
     * @dev Get the presigned order owner.
     * @param orderHash The order hash.
     * @return The presigned order owner address.
     */
    function presigned(bytes32 orderHash) internal view returns (address) {
        return getPocoStorage().m_presigned[orderHash];
    }

    /**
     * @dev Get the consumed amount of an order.
     * @param orderHash The order hash.
     * @return The consumed amount.
     */
    function consumed(bytes32 orderHash) internal view returns (uint256) {
        return getPocoStorage().m_consumed[orderHash];
    }

    /**
     * @dev Get a deal by its ID.
     * @param dealId The deal ID.
     * @return The deal struct.
     */
    function deals(bytes32 dealId) internal view returns (IexecLibCore_v5.Deal storage) {
        return getPocoStorage().m_deals[dealId];
    }

    /**
     * @dev Get a boost deal by its ID.
     * @param dealId The deal ID.
     * @return The boost deal struct.
     */
    function dealsBoost(bytes32 dealId) internal view returns (IexecLibCore_v5.DealBoost storage) {
        return getPocoStorage().m_dealsBoost[dealId];
    }

    /**
     * @dev Get a task by its ID.
     * @param taskId The task ID.
     * @return The task struct.
     */
    function tasks(bytes32 taskId) internal view returns (IexecLibCore_v5.Task storage) {
        return getPocoStorage().m_tasks[taskId];
    }

    /**
     * @dev Get a consensus by task ID.
     * @param taskId The task ID.
     * @return The consensus struct.
     */
    function consensus(bytes32 taskId) internal view returns (IexecLibCore_v5.Consensus storage) {
        return getPocoStorage().m_consensus[taskId];
    }

    /**
     * @dev Get a contribution by task ID and worker address.
     * @param taskId The task ID.
     * @param worker The worker address.
     * @return The contribution struct.
     */
    function contributions(
        bytes32 taskId,
        address worker
    ) internal view returns (IexecLibCore_v5.Contribution storage) {
        return getPocoStorage().m_contributions[taskId][worker];
    }

    /**
     * @dev Get the worker score.
     * @param worker The worker address.
     * @return The worker score.
     */
    function workerScores(address worker) internal view returns (uint256) {
        return getPocoStorage().m_workerScores[worker];
    }

    /**
     * @dev Get the TEE broker address.
     * @return The TEE broker address.
     */
    function teeBroker() internal view returns (address) {
        return getPocoStorage().m_teebroker;
    }

    /**
     * @dev Get the callback gas limit.
     * @return The callback gas limit.
     */
    function callbackGas() internal view returns (uint256) {
        return getPocoStorage().m_callbackgas;
    }

    /**
     * @dev Get all categories.
     * @return The categories array.
     */
    function categories() internal view returns (IexecLibCore_v5.Category[] storage) {
        return getPocoStorage().m_categories;
    }

    /**
     * @dev Get a category by index.
     * @param index The category index.
     * @return The category struct.
     */
    function category(uint256 index) internal view returns (IexecLibCore_v5.Category storage) {
        return getPocoStorage().m_categories[index];
    }

    /**
     * @dev Get the v3 iExec Hub address.
     * @return The v3 iExec Hub address.
     */
    function v3IexecHub() internal view returns (address) {
        return getPocoStorage().m_v3_iexecHub;
    }

    /**
     * @dev Check if v3 score is imported for an address.
     * @param addr The address to check.
     * @return True if v3 score is imported.
     */
    function v3ScoreImported(address addr) internal view returns (bool) {
        return getPocoStorage().m_v3_scoreImported[addr];
    }

    // === Storage Setter Functions ===

    /**
     * @dev Set the app registry contract.
     * @param registry The app registry contract.
     */
    function setAppRegistry(IRegistry registry) internal {
        getPocoStorage().m_appregistry = registry;
    }

    /**
     * @dev Set the dataset registry contract.
     * @param registry The dataset registry contract.
     */
    function setDatasetRegistry(IRegistry registry) internal {
        getPocoStorage().m_datasetregistry = registry;
    }

    /**
     * @dev Set the workerpool registry contract.
     * @param registry The workerpool registry contract.
     */
    function setWorkerpoolRegistry(IRegistry registry) internal {
        getPocoStorage().m_workerpoolregistry = registry;
    }

    /**
     * @dev Set the base token contract.
     * @param token The base token contract.
     */
    function setBaseToken(IERC20 token) internal {
        getPocoStorage().m_baseToken = token;
    }

    /**
     * @dev Set the token name.
     * @param newName The new token name.
     */
    function setName(string memory newName) internal {
        getPocoStorage().m_name = newName;
    }

    /**
     * @dev Set the token symbol.
     * @param newSymbol The new token symbol.
     */
    function setSymbol(string memory newSymbol) internal {
        getPocoStorage().m_symbol = newSymbol;
    }

    /**
     * @dev Set the token decimals.
     * @param newDecimals The new token decimals.
     */
    function setDecimals(uint8 newDecimals) internal {
        getPocoStorage().m_decimals = newDecimals;
    }

    /**
     * @dev Set the total supply.
     * @param newTotalSupply The new total supply.
     */
    function setTotalSupply(uint256 newTotalSupply) internal {
        getPocoStorage().m_totalSupply = newTotalSupply;
    }

    /**
     * @dev Set the balance of an account.
     * @param account The account address.
     * @param amount The balance amount.
     */
    function setBalance(address account, uint256 amount) internal {
        getPocoStorage().m_balances[account] = amount;
    }

    /**
     * @dev Set the frozen balance of an account.
     * @param account The account address.
     * @param amount The frozen balance amount.
     */
    function setFrozen(address account, uint256 amount) internal {
        getPocoStorage().m_frozens[account] = amount;
    }

    /**
     * @dev Set the allowance amount.
     * @param owner The owner address.
     * @param spender The spender address.
     * @param amount The allowance amount.
     */
    function setAllowance(address owner, address spender, uint256 amount) internal {
        getPocoStorage().m_allowances[owner][spender] = amount;
    }

    /**
     * @dev Set the EIP712 domain separator.
     * @param newDomainSeparator The new domain separator hash.
     */
    function setDomainSeparator(bytes32 newDomainSeparator) internal {
        getPocoStorage().m_eip712DomainSeparator = newDomainSeparator;
    }

    /**
     * @dev Set the presigned order owner.
     * @param orderHash The order hash.
     * @param owner The presigned order owner address.
     */
    function setPresigned(bytes32 orderHash, address owner) internal {
        getPocoStorage().m_presigned[orderHash] = owner;
    }

    /**
     * @dev Set the consumed amount of an order.
     * @param orderHash The order hash.
     * @param amount The consumed amount.
     */
    function setConsumed(bytes32 orderHash, uint256 amount) internal {
        getPocoStorage().m_consumed[orderHash] = amount;
    }

    /**
     * @dev Set the worker score.
     * @param worker The worker address.
     * @param score The worker score.
     */
    function setWorkerScore(address worker, uint256 score) internal {
        getPocoStorage().m_workerScores[worker] = score;
    }

    /**
     * @dev Set the TEE broker address.
     * @param broker The TEE broker address.
     */
    function setTeeBroker(address broker) internal {
        getPocoStorage().m_teebroker = broker;
    }

    /**
     * @dev Set the callback gas limit.
     * @param gas The callback gas limit.
     */
    function setCallbackGas(uint256 gas) internal {
        getPocoStorage().m_callbackgas = gas;
    }

    /**
     * @dev Add a new category.
     * @param cat The category to add.
     */
    function addCategory(IexecLibCore_v5.Category memory cat) internal {
        getPocoStorage().m_categories.push(cat);
    }

    /**
     * @dev Set the v3 iExec Hub address.
     * @param hub The v3 iExec Hub address.
     */
    function setV3IexecHub(address hub) internal {
        getPocoStorage().m_v3_iexecHub = hub;
    }

    /**
     * @dev Set the v3 score imported flag for an address.
     * @param addr The address.
     * @param imported The imported flag.
     */
    function setV3ScoreImported(address addr, bool imported) internal {
        getPocoStorage().m_v3_scoreImported[addr] = imported;
    }
}

// Registry interface used in storage.
interface IRegistry is IERC721Enumerable {
    function isRegistered(address _entry) external view returns (bool);
}
