// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Enumerable.sol";

interface IRegistry is IERC721Enumerable {
    function isRegistered(address _entry) external view returns (bool);
}
