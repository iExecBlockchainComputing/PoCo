// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;


interface IexecTokenSpender
{
	function receiveApproval(address,uint256,address,bytes calldata) external returns (bool);
}
