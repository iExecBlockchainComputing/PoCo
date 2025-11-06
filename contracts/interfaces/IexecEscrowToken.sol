// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

interface IexecEscrowToken {
    receive() external payable;
    fallback() external payable;
    event ApprovalReceivedAndMatched(
        address indexed sender,
        uint256 amount,
        bytes32 indexed dealId
    );
    function deposit(uint256) external returns (bool);
    function depositFor(uint256, address) external returns (bool);
    function depositForArray(uint256[] calldata, address[] calldata) external returns (bool);
    function withdraw(uint256) external returns (bool);
    function withdrawTo(uint256, address) external returns (bool);
    function recover() external returns (uint256);
}
