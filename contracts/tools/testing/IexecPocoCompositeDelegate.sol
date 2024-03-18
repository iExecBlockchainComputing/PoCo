// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecPocoAccessorsDelegate} from "../../modules/delegates/IexecPocoAccessorsDelegate.sol";
import {IexecPoco1Delegate} from "../../modules/delegates/IexecPoco1Delegate.sol";

/**
 * @notice This contract is dedicated to unit testing.
 */
contract IexecPocoCompositeDelegate is IexecPocoAccessorsDelegate, IexecPoco1Delegate {

}
