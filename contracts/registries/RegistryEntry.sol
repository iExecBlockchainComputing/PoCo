// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;

import "./Registry.sol";

/**
 * @dev Referenced in the SDK with the current path `contracts/registries/RegistryEntry.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
abstract contract RegistryEntry {
    IRegistry public registry;

    modifier onlyOwner() {
        require(owner() == msg.sender, "caller is not the owner");
        _;
    }

    function owner() public view returns (address) {
        return registry.ownerOf(uint256(address(this)));
    }

    /**
     * Sets the reverse registration name for a registry entry contract.
     * @dev This functionality is supported only on Bellecour Sidechain, calls on other chains
     * will revert. The function is kept as nonpayable to maintain retrocompatibility with the
     * iExec SDK.
     */
    // TODO remove this function when Bellecour is deprecated.
    function setName(address /* _ens */, string calldata /* _name */) external onlyOwner {
        registry = registry; // Remove solidity state mutability warning.
        revert("Operation not supported on this chain");
    }

    function _initialize(address _registry) internal {
        require(address(registry) == address(0), "already initialized");
        registry = IRegistry(_registry);
    }
}
