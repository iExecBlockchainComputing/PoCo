// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecEscrow} from "../../modules/delegates/IexecEscrow.v8.sol";

contract IexecEscrowTestContract is IexecEscrow {
    /**
     * Wrapper method to test private function IexecEscrow#_transfer().
     * @param account destination address
     * @param value amount to be transferred
     */
    function transfer__(address account, uint256 value) public {
        reward(account, value, bytes32(0));
    }
}
