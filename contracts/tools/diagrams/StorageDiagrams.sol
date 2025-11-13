// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {LibDiamond} from "@mudgen/diamond-1/contracts/libraries/LibDiamond.sol";
import {PocoStorageLib} from "../../libs/PocoStorageLib.sol";

// /!\ These contracts are only used to generate storage diagrams, they are not meant
// to be deployed or used in any way.
// PocoStorageLib and LibDiamond use namespaced storage which makes sol2uml unable to
// generate diagrams directly, so these contracts provide their structs to sol2uml.

contract DiamondStorageDiagram {
    LibDiamond.DiamondStorage diamondStorage;
}

contract PocoStorageDiagram {
    PocoStorageLib.PocoStorage pocoStorage;
}
