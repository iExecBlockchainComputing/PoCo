// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@iexec/solidity/contracts/ENStools/ENSReverseRegistration.sol";
import "../DelegateBase.sol";
import "../interfaces/ENSIntegration.sol";

contract ENSIntegrationDelegate is ENSIntegration, ENSReverseRegistration, DelegateBase {
    function setName(address _ens, string calldata _name) external override onlyOwner {
        _setName(IENS(_ens), _name);
    }
}
