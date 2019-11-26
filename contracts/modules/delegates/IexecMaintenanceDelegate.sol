pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/IexecMaintenance.sol";


contract IexecMaintenanceDelegate is IexecMaintenance, DelegateBase
{
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.EIP712Domain;

	// TODO
	// function _chainId()
	// internal pure returns (uint256)
	// {
	// 	uint256 id;
	// 	assembly { id := chainid() }
	// 	return id;
	// }

	function _updateDomainSeparator(uint256 _chainid)
	internal
	{
		EIP712DOMAIN_SEPARATOR = IexecODBLibOrders_v4.EIP712Domain({
			name:              "iExecODB"
		, version:           "3.0-alpha"
		, chainId:           _chainid
		, verifyingContract: address(this)
		}).hash();
	}

	function configure(
		address          _token,
		string  calldata _name,
		string  calldata _symbol,
		uint8            _decimal,
		address          _appregistryAddress,
		address          _datasetregistryAddress,
		address          _workerpoolregistryAddress,
		address          _v3_iexecHubAddress)
	external
	{
		require(EIP712DOMAIN_SEPARATOR == bytes32(0), "already-configured");
		m_baseToken          = IERC20(_token);
		m_name               = _name;
		m_symbol             = _symbol;
		m_decimals           = _decimal;
		m_appregistry        = IRegistry(_appregistryAddress);
		m_datasetregistry    = IRegistry(_datasetregistryAddress);
		m_workerpoolregistry = IRegistry(_workerpoolregistryAddress);
		m_v3_iexecHub        = IexecHub(_v3_iexecHubAddress);
	}

	function updateChainId(uint256 _chainid)
	external
	{
		require(EIP712DOMAIN_SEPARATOR == bytes32(0), "already-configured"); //TODO: remove and using chainId opcode
		_updateDomainSeparator(_chainid);
	}

	function importScore(address _worker)
	external
	{
		require(!m_v3_scoreImported[_worker], "score-already-imported");
		m_workerScores[_worker] = m_v3_iexecHub.viewScore(_worker);
		m_v3_scoreImported[_worker] = true;
	}
}
