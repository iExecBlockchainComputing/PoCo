// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecLibCore_v5} from "../../libs/IexecLibCore_v5.sol";

interface IexecPocoBoostAccessors {
    function viewDealBoost(bytes32 id) external view returns (IexecLibCore_v5.DealBoost memory);
}
