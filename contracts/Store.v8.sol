// SPDX-License-Identifier: Apache-2.0

/******************************************************************************
 * Copyright 2023 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts-v4/interfaces/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts-v4/interfaces/IERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts-v4/access/Ownable.sol";

import {IexecLibCore_v5} from "./libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "./libs/IexecLibOrders_v5.sol";

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

/// @dev IERC20KYC
interface IERC1404 {
    function detectTransferRestriction(
        address from,
        address to,
        uint256 value
    ) external view returns (uint8);

    function messageForTransferRestriction(
        uint8 restrictionCode
    ) external view returns (string memory);
}

interface IKYC {
    function KYC_ADMIN_ROLE() external view returns (bytes32);

    function KYC_MEMBER_ROLE() external view returns (bytes32);

    function isKYC(address) external view returns (bool);

    function grantKYC(address[] calldata) external;

    function revokeKYC(address[] calldata) external;
}

interface IERC20KYC is IERC1404, IKYC, IERC20 {}

/// @dev Poco store
abstract contract Store is ERC1538Store {
    // Registries
    IRegistry internal m_appregistry;
    IRegistry internal m_datasetregistry;
    IRegistry internal m_workerpoolregistry;

    // Escrow
    IERC20KYC internal m_baseToken;
    string internal m_name;
    string internal m_symbol;
    uint8 internal m_decimals;
    uint256 internal m_totalSupply;

    mapping(address => uint256) internal m_balances;
    mapping(address => uint256) internal m_frozens;
    mapping(address => mapping(address => uint256)) internal m_allowances;

    // Poco - Constants
    uint256 internal constant CONTRIBUTION_DEADLINE_RATIO = 7;
    uint256 internal constant REVEAL_DEADLINE_RATIO = 2;
    uint256 internal constant FINAL_DEADLINE_RATIO = 10;
    uint256 internal constant WORKERPOOL_STAKE_RATIO = 30;
    uint256 internal constant KITTY_RATIO = 10;
    uint256 internal constant KITTY_MIN = 1000000000; // ADJUSTEMENT VARIABLE
    address internal constant KITTY_ADDRESS = 0x99c2268479b93fDe36232351229815DF80837e23; // address(uint256(keccak256(bytes('iExecKitty'))) - 1);
    uint256 internal constant GROUPMEMBER_PURPOSE = 4;
    bytes32 internal EIP712DOMAIN_SEPARATOR;

    // Poco - Storage
    mapping(bytes32 => address) internal m_presigned; // per order
    mapping(bytes32 => uint256) internal m_consumed; // per order
    mapping(bytes32 => IexecLibCore_v5.Deal) internal m_deals; // per deal
    mapping(bytes32 => IexecLibCore_v5.Task) internal m_tasks; // per task
    mapping(bytes32 => IexecLibCore_v5.Consensus) internal m_consensus; // per task
    mapping(bytes32 => mapping(address => IexecLibCore_v5.Contribution)) internal m_contributions; // per task-worker
    mapping(address => uint256) internal m_workerScores; // per worker

    // Poco - Settings
    address internal m_teebroker;
    uint256 internal m_callbackgas;

    // Categories
    IexecLibCore_v5.Category[] internal m_categories;

    // Backward compatibility
    address internal m_v3_iexecHub; // IexecHubInterface
    mapping(address => bool) internal m_v3_scoreImported;

    // Boost
    mapping(bytes32 => IexecLibCore_v5.DealBoost) internal m_dealsBoost; // per deal
}
