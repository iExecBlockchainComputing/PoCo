pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/IexecMaintenance.sol";


contract IexecMaintenanceDelegate is IexecMaintenance, DelegateBase
{
	using IexecODBLibOrders_v4 for IexecODBLibOrders_v4.EIP712Domain;

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
		EIP712DOMAIN_SEPARATOR = _domain().hash();

		m_baseToken          = IERC20(_token);
		m_name               = _name;
		m_symbol             = _symbol;
		m_decimals           = _decimal;
		m_appregistry        = IRegistry(_appregistryAddress);
		m_datasetregistry    = IRegistry(_datasetregistryAddress);
		m_workerpoolregistry = IRegistry(_workerpoolregistryAddress);
		m_v3_iexecHub        = IexecHubInterface(_v3_iexecHubAddress);
	}

	function domain()
	external view returns (IexecODBLibOrders_v4.EIP712Domain memory)
	{
		return _domain();
	}

	function updateDomainSeparator()
	external
	{
		require(EIP712DOMAIN_SEPARATOR != bytes32(0), "already-configured");
		EIP712DOMAIN_SEPARATOR = _domain().hash();
	}

	function importScore(address _worker)
	external
	{
		require(!m_v3_scoreImported[_worker], "score-already-imported");
		m_workerScores[_worker] = m_v3_iexecHub.viewScore(_worker);
		m_v3_scoreImported[_worker] = true;
	}

	function _chainId()
	internal pure returns (uint256 id)
	{
		assembly { id := chainid() }
	}

	function _domain()
	internal view returns (IexecODBLibOrders_v4.EIP712Domain memory)
	{
		return IexecODBLibOrders_v4.EIP712Domain({
			name:              "iExecODB"
		, version:           "3.0-alpha"
		, chainId:           _chainId()
		, verifyingContract: address(this)
		});
	}
}
