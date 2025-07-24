// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@iexec/solidity/contracts/ENStools/ENSReverseRegistration.sol";
import "../FacetBase.sol";
import "../interfaces/ENSIntegration.sol";

// TODO don't deploy this as ENSReverseRegistration.ADDR_REVERSE_NODE is not defined on Arbitrum.
// TODO update this to use ENS on Arbitrum (update everywhere this is used).
contract ENSIntegrationFacet is ENSIntegration, ENSReverseRegistration, FacetBase {
    function setName(address _ens, string calldata _name) external override onlyOwner {
        _setName(IENS(_ens), _name);
    }
}
