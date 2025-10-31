// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../../interfaces/IexecTokenSpender.sol";

contract TestReceiver is IexecTokenSpender {
    event GotApproval(address sender, uint256 value, address token, bytes extraData);

    function receiveApproval(
        address _sender,
        uint256 _value,
        address _token,
        bytes calldata _extraData
    ) external override returns (bool) {
        if (_value == 0) {
            return false;
        } else {
            emit GotApproval(_sender, _value, _token, _extraData);
            return true;
        }
    }
}
