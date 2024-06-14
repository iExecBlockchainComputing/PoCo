// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IexecEscrowNative {
    receive() external payable;

    fallback() external payable;

    function deposit() external payable returns (bool);

    function depositFor(address) external payable returns (bool);

    function depositForArray(
        uint256[] calldata,
        address[] calldata
    ) external payable returns (bool);

    function withdraw(uint256) external returns (bool);

    function withdrawTo(uint256, address) external returns (bool);

    function recover() external returns (uint256);
}
