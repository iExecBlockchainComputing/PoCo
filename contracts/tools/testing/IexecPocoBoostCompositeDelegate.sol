// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecPocoBoostAccessorsDelegate} from "../../modules/delegates/IexecPocoBoostAccessorsDelegate.sol";
import {IexecPocoBoostDelegate} from "../../modules/delegates/IexecPocoBoostDelegate.sol";

/**
 * @notice This contract is dedicated to unit testing.
 */
contract IexecPocoBoostCompositeDelegate is
    IexecPocoBoostAccessorsDelegate,
    IexecPocoBoostDelegate
{

}
