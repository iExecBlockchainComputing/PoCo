// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./FacetBase.sol";
import "../interfaces/IexecConfiguration.sol";
import {LibPocoStorage} from "../libs/LibPocoStorage.sol";

contract IexecConfigurationFacet is IexecConfiguration, FacetBase {
    using SafeMathExtended for uint256;
    using IexecLibOrders_v5 for IexecLibOrders_v5.EIP712Domain;

    // TODO move this to DiamondInit.init().
    function configure(
        address _token,
        string calldata _name,
        string calldata _symbol,
        uint8 _decimal,
        address _appregistryAddress,
        address _datasetregistryAddress,
        address _workerpoolregistryAddress,
        address _v3_iexecHubAddress
    ) external override onlyOwner {
        require(LibPocoStorage.domainSeparator() == bytes32(0), "already-configured");
        LibPocoStorage.setDomainSeparator(_domain().hash());
        LibPocoStorage.setBaseToken(IERC20(_token));
        LibPocoStorage.setName(_name);
        LibPocoStorage.setSymbol(_symbol);
        LibPocoStorage.setDecimals(_decimal);
        LibPocoStorage.setAppRegistry(IRegistry(_appregistryAddress));
        LibPocoStorage.setDatasetRegistry(IRegistry(_datasetregistryAddress));
        LibPocoStorage.setWorkerpoolRegistry(IRegistry(_workerpoolregistryAddress));
        LibPocoStorage.setV3IexecHub(IexecHubInterface(_v3_iexecHubAddress));
        LibPocoStorage.setCallbackGas(100000);
    }

    function domain() external view override returns (IexecLibOrders_v5.EIP712Domain memory) {
        return _domain();
    }

    function updateDomainSeparator() external override {
        require(LibPocoStorage.domainSeparator() != bytes32(0), "not-configured");
        LibPocoStorage.setDomainSeparator(_domain().hash());
    }

    function importScore(address _worker) external override {
        require(!LibPocoStorage.v3ScoreImported(_worker), "score-already-imported");
        uint256 currentScore = LibPocoStorage.workerScores(_worker);
        uint256 newScore = currentScore.max(
            IexecHubInterface(LibPocoStorage.v3IexecHub()).viewScore(_worker)
        );
        LibPocoStorage.setWorkerScore(_worker, newScore);
        LibPocoStorage.setV3ScoreImported(_worker, true);
    }

    function setTeeBroker(address _teebroker) external override onlyOwner {
        LibPocoStorage.setTeeBroker(_teebroker);
    }

    function setCallbackGas(uint256 _callbackgas) external override onlyOwner {
        LibPocoStorage.setCallbackGas(_callbackgas);
    }

    function _chainId() internal pure returns (uint256 id) {
        assembly {
            id := chainid()
        }
    }

    function _domain() internal view returns (IexecLibOrders_v5.EIP712Domain memory) {
        return
            IexecLibOrders_v5.EIP712Domain({
                name: "iExecODB",
                version: "5.0.0",
                chainId: _chainId(),
                verifyingContract: address(this)
            });
    }
}
