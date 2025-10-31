// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Registry} from "../Registry.sol";
import {Workerpool} from "./Workerpool.sol";

/**
 * @dev Referenced in the SDK with the current path `contracts/registries/workerpools/WorkerpoolRegistry.sol`.
 * Changing the name or the path would cause a breaking change in the SDK.
 */
contract WorkerpoolRegistry is Registry {
    /**
     * Constructor
     */
    constructor()
        Registry(address(new Workerpool()), "iExec Workerpool Registry (V5)", "iExecWorkerpoolV5")
    {}

    /**
     * Pool creation
     */
    function encodeInitializer(
        string memory _workerpoolDescription
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSignature("initialize(string)", _workerpoolDescription);
    }

    function createWorkerpool(
        address _workerpoolOwner,
        string calldata _workerpoolDescription
    ) external returns (Workerpool) {
        bytes memory initializer = encodeInitializer(_workerpoolDescription);
        address entry = _mintPredict(_workerpoolOwner, initializer);
        // TEMPORARY MIGRATION FIX: Check if contract already exists to revert without custom error for backward compatibility
        // TODO: Remove this in the next major version
        if (entry.code.length > 0) {
            revert("Create2: Failed on deploy");
        }
        _mintCreate(_workerpoolOwner, initializer);
        return Workerpool(entry);
    }

    function predictWorkerpool(
        address _workerpoolOwner,
        string calldata _workerpoolDescription
    ) external view returns (Workerpool) {
        return
            Workerpool(_mintPredict(_workerpoolOwner, encodeInitializer(_workerpoolDescription)));
    }
}
