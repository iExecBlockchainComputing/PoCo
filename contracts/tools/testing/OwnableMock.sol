// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-v5/access/Ownable.sol";

contract OwnableMock is Ownable {
    constructor() Ownable(msg.sender) {}
}
