// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0
// TODO: Remove header bellow
/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
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

pragma solidity >=0.6.0;

library IexecLibCore_v5 {
    /**
     * Tools
     */
    struct Account {
        uint256 stake;
        uint256 locked;
    }
    struct Category {
        string name;
        string description;
        uint256 workClockTimeRef;
    }

    /**
     * Clerk - Deals
     */
    struct Resource {
        address pointer;
        address owner;
        uint256 price;
    }
    struct Deal {
        // Ressources
        Resource app;
        Resource dataset;
        Resource workerpool;
        uint256 trust;
        uint256 category;
        bytes32 tag;
        // execution details
        address requester;
        address beneficiary;
        address callback;
        string params;
        // execution settings
        uint256 startTime;
        uint256 botFirst;
        uint256 botSize;
        // consistency
        uint256 workerStake;
        uint256 schedulerRewardRatio;
        address sponsor;
    }

    /**
     * Simplified deals for PoCo Boost module.
     */
    struct DealBoost {
        // Offset 0
        address appOwner;
        uint96 appPrice;
        // Offset 1
        address datasetOwner;
        uint96 datasetPrice;
        // Offset 2
        address workerpoolOwner;
        uint96 workerpoolPrice;
        // Offset 3
        address requester;
        uint96 workerReward;
        // Offset 4
        address callback;
        uint40 deadline; // Max: 1099511627776 => ∞
        uint16 botFirst; // Max: 65535
        uint16 botSize; // Max: 65535
        bytes3 shortTag; // Max: 0b111111111111111111111111 (0xFFFFFF)
        // Offset 5
        address sponsor;
    }
    /**
     * Tasks
     */
    enum TaskStatusEnum {
        UNSET, // Work order not yet initialized (invalid address)
        ACTIVE, // Marketed → constributions are open
        REVEALING, // Starting consensus reveal
        COMPLETED, // Consensus achieved
        FAILED // Failed consensus
    }
    struct Task {
        TaskStatusEnum status;
        bytes32 dealid;
        uint256 idx;
        uint256 timeref;
        uint256 contributionDeadline;
        uint256 revealDeadline;
        uint256 finalDeadline;
        bytes32 consensusValue;
        uint256 revealCounter;
        uint256 winnerCounter;
        address[] contributors;
        bytes32 resultDigest;
        bytes results;
        uint256 resultsTimestamp;
        bytes resultsCallback; // Expansion - result separation
    }

    /**
     * Consensus
     */
    struct Consensus {
        mapping(bytes32 => uint256) group;
        uint256 total;
    }

    /**
     * Consensus
     */
    enum ContributionStatusEnum {
        UNSET,
        CONTRIBUTED,
        PROVED,
        REJECTED
    }
    struct Contribution {
        ContributionStatusEnum status;
        bytes32 resultHash;
        bytes32 resultSeal;
        address enclaveChallenge;
        uint256 weight;
    }
}
