// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../Registry.sol";
import "./Workerpool.sol";

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
        address entry = _mintCreate(_workerpoolOwner, initializer);
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
