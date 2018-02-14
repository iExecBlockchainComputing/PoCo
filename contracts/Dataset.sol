pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import "./AuthorizedList.sol";

contract Dataset is OwnableOZ, IexecHubAccessor
{

	enum DatasetStatusEnum { OPEN, CLOSE }

	/**
	 * Members
	 */
	string            public m_datasetName;
	uint256           public m_datasetPrice;
	string            public m_datasetParams;
	DatasetStatusEnum public m_datasetStatus;

	/**
	 * Address of slave contracts
	 */
	address           public m_workerPoolsAuthorizedListAddress;
	address           public m_appsAuthorizedListAddress;
	address           public m_requestersAuthorizedListAddress;

	// TODO add OPEN and CLOSE STATUS for datasetUri maintenance

	// Constructor
	function Dataset(
		address _iexecHubAddress,
		string  _datasetName,
		uint256 _datasetPrice,
		string  _datasetParams)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender == DatasetHub
		require(tx.origin != msg.sender);
		transferOwnership(tx.origin); // owner → tx.origin

		m_datasetName   = _datasetName;
		m_datasetPrice  = _datasetPrice;
		m_datasetParams = _datasetParams;
		m_datasetStatus = DatasetStatusEnum.OPEN;

		m_appsAuthorizedListAddress        = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		m_requestersAuthorizedListAddress  = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		m_workerPoolsAuthorizedListAddress = new AuthorizedList(AuthorizedList.ListPolicyEnum.WHITELIST);
		AuthorizedList(m_appsAuthorizedListAddress       ).transferOwnership(tx.origin); // owner → tx.origin
		AuthorizedList(m_requestersAuthorizedListAddress ).transferOwnership(tx.origin); // owner → tx.origin
		AuthorizedList(m_workerPoolsAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin

	}

	function open() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(m_datasetStatus == DatasetStatusEnum.CLOSE);
		m_datasetStatus = DatasetStatusEnum.OPEN;
		return true;
	}

	function close() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(m_datasetStatus == DatasetStatusEnum.OPEN);
		m_datasetStatus = DatasetStatusEnum.CLOSE;
		return true;
	}

	function isOpen() public view returns (bool)
	{
		return m_datasetStatus == DatasetStatusEnum.OPEN;
	}

	function isWorkerPoolAllowed(address _workerPool) public returns (bool)
	{
		return AuthorizedList(m_workerPoolsAuthorizedListAddress).isActorAllowed(_workerPool);
	}

	function isAppAllowed(address _app) public returns (bool)
	{
	  return AuthorizedList(m_appsAuthorizedListAddress).isActorAllowed(_app);
	}

	function isRequesterAllowed(address _requester) public returns (bool)
	{
	  return AuthorizedList(m_requestersAuthorizedListAddress).isActorAllowed(_requester);
	}

}
