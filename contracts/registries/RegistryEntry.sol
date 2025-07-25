// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;

import "./Registry.sol";

abstract contract RegistryEntry {
    IRegistry public registry;

    function _initialize(address _registry) internal {
        require(address(registry) == address(0), "already initialized");
        registry = IRegistry(_registry);
    }

    function owner() public view returns (address) {
        return registry.ownerOf(uint256(address(this)));
    }

    modifier onlyOwner() {
        require(owner() == msg.sender, "caller is not the owner");
        _;
    }
}
