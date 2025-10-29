// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {FacetBase} from "./FacetBase.sol";
import {IexecConfiguration} from "../interfaces/IexecConfiguration.sol";
import {IexecHubV3Interface} from "../interfaces/IexecHubV3Interface.sol";
import {IRegistry} from "../registries/IRegistry.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
import {IexecLibOrders_v5} from "../libs/IexecLibOrders_v5.sol";

contract IexecConfigurationFacet is IexecConfiguration, FacetBase {
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
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        require($.m_eip712DomainSeparator == bytes32(0), "already-configured");
        $.m_eip712DomainSeparator = _domain().hash();
        $.m_baseToken = IERC20(_token);
        $.m_name = _name;
        $.m_symbol = _symbol;
        $.m_decimals = _decimal;
        $.m_appregistry = IRegistry(_appregistryAddress);
        $.m_datasetregistry = IRegistry(_datasetregistryAddress);
        $.m_workerpoolregistry = IRegistry(_workerpoolregistryAddress);
        $.m_v3_iexecHub = IexecHubV3Interface(_v3_iexecHubAddress);
        $.m_callbackgas = 100000;
    }

    function domain() external view override returns (IexecLibOrders_v5.EIP712Domain memory) {
        return _domain();
    }

    function updateDomainSeparator() external override {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        require($.m_eip712DomainSeparator != bytes32(0), "not-configured");
        $.m_eip712DomainSeparator = _domain().hash();
    }

    function importScore(address _worker) external override {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        require(!$.m_v3_scoreImported[_worker], "score-already-imported");
        $.m_workerScores[_worker] = Math.max(
            $.m_workerScores[_worker],
            $.m_v3_iexecHub.viewScore(_worker)
        );
        $.m_v3_scoreImported[_worker] = true;
    }

    function setTeeBroker(address _teebroker) external override onlyOwner {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_teebroker = _teebroker;
    }

    function setCallbackGas(uint256 _callbackgas) external override onlyOwner {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        $.m_callbackgas = _callbackgas;
    }

    function _chainId() internal view returns (uint256 id) {
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
