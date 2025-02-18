// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {Clones} from "@openzeppelin/contracts-v5/proxy/Clones.sol";
import {Datapool} from "./Datapool.sol";

pragma solidity ^0.8.0;

contract DatapoolRegistry {
    address private implementation;
    mapping(address => bool) datapools;

    constructor(address _implementation) {
        implementation = _implementation;
    }

    function isRegistered(address datapool) external view returns (bool) {
        return datapools[datapool];
    }

    function createDatapool(address admin) external returns (address) {
        address datapool = Clones.cloneDeterministic(implementation, _getSalt(admin));
        require(!datapools[datapool], "Datapool already created");
        datapools[datapool] = true;
        Datapool(datapool).initialize(admin);
        return datapool;
    }

    function predictDatapool(address admin) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, _getSalt(admin), address(this));
    }

    function _getSalt(address admin) private pure returns (bytes32) {
        return keccak256(abi.encode(admin));
    }
}
