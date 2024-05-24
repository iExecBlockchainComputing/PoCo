// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {DelegateBase} from "../DelegateBase.v8.sol";
import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";
import {Math} from "@openzeppelin/contracts-v5/utils/math/Math.sol";
import {MessageHashUtils} from "@openzeppelin/contracts-v5/utils/cryptography/MessageHashUtils.sol";
import {IexecMath} from "../interfaces/IexecMath.sol";

contract IexecMathDelegate is DelegateBase, IexecMath {
    using Math for uint256;

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
    ) external view override returns (uint256 volume) {
        return
            _computeVolume(
                apporderVolume,
                appOrderTypedDataHash,
                hasDataset,
                datasetorderVolume,
                datasetOrderTypedDataHash,
                workerpoolorderVolume,
                workerpoolOrderTypedDataHash,
                requestorderVolume,
                requestOrderTypedDataHash
            );
    }

    function _computeVolume(
        uint256 apporderVolume,
        bytes32 appOrderTypedDataHash,
        bool hasDataset,
        uint256 datasetorderVolume,
        bytes32 datasetOrderTypedDataHash,
        uint256 workerpoolorderVolume,
        bytes32 workerpoolOrderTypedDataHash,
        uint256 requestorderVolume,
        bytes32 requestOrderTypedDataHash
    ) internal view returns (uint256 volume) {
        volume = apporderVolume - m_consumed[appOrderTypedDataHash];
        volume = hasDataset
            ? volume.min(datasetorderVolume - m_consumed[datasetOrderTypedDataHash])
            : volume;
        volume = volume.min(workerpoolorderVolume - m_consumed[workerpoolOrderTypedDataHash]);
        volume = volume.min(requestorderVolume - m_consumed[requestOrderTypedDataHash]);
    }
}
