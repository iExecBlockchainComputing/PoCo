// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {DelegateBase} from "../DelegateBase.v8.sol";
import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";
import {Math} from "@openzeppelin/contracts-v5/utils/math/Math.sol";
import {MessageHashUtils} from "@openzeppelin/contracts-v5/utils/cryptography/MessageHashUtils.sol";

interface IexecMath {
    function computeVolume(
        uint256 apporderVolume,
        bytes32 appOrderTypedDataHash,
        bool hasDataset,
        uint256 datasetorderVolume,
        bytes32 datasetOrderTypedDataHash,
        uint256 workerpoolorderVolume,
        bytes32 workerpoolOrderTypedDataHash,
        uint256 requestorderVolume,
        bytes32 requestOrderTypedDataHash
    ) external view returns (uint256 volume);
}
