// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import "@openzeppelin/contracts-v5/proxy/utils/Initializable.sol";

pragma solidity ^0.8.0;

contract Datapool is Initializable {
    address public admin;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _admin) public initializer {
        admin = _admin;
    }
}
