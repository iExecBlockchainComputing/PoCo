// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IexecEscrow} from "../../modules/facets/IexecEscrow.v8.sol";

/**
 * @notice a wrapper contract to make internal functions of
 * IexecEscrow.v8 testable.
 */
contract IexecEscrowTestContract is IexecEscrow {
    function lock_(address account, uint256 value) external {
        lock(account, value);
    }

    function unlock_(address account, uint256 value) external {
        unlock(account, value);
    }

    function reward_(address account, uint256 value, bytes32 ref) external {
        reward(account, value, ref);
    }

    function seize_(address account, uint256 value, bytes32 ref) external {
        seize(account, value, ref);
    }

    // Helper functions used in unit tests.

    function setBalance(address account, uint256 value) external {
        m_balances[account] = value;
    }

    // TODO remove the following function and inherit `IexecAccessorsFacet`
    // when it is migrated to solidity v8.

    function balanceOf(address account) external view returns (uint256) {
        return m_balances[account];
    }

    function frozenOf(address account) external view returns (uint256) {
        return m_frozens[account];
    }
}
