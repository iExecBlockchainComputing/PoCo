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
	AuthorizedList public appsAuthorizedListAddress;
	AuthorizedList public requestersAuthorizedListAddress;
	AuthorizedList public workerPoolsAuthorizedListAddress;

	/**
	 * Constructor
	 */
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

		appsAuthorizedListAddress        = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		requestersAuthorizedListAddress  = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		workerPoolsAuthorizedListAddress = new AuthorizedList(AuthorizedList.ListPolicyEnum.WHITELIST);
		appsAuthorizedListAddress.transferOwnership(tx.origin); // owner → tx.origin
		requestersAuthorizedListAddress.transferOwnership(tx.origin); // owner → tx.origin
		workerPoolsAuthorizedListAddress.transferOwnership(tx.origin); // owner → tx.origin
	}

	/************************ AuthorizedList accessors *************************/
	function isWorkerPoolAllowed(address _workerPool) public view returns (bool)
	{
		return workerPoolsAuthorizedListAddress.isActorAllowed(_workerPool);
	}
	function isAppAllowed(address _app) public view returns (bool)
	{
	  return appsAuthorizedListAddress.isActorAllowed(_app);
	}
	function isRequesterAllowed(address _requester) public view returns (bool)
	{
	  return requestersAuthorizedListAddress.isActorAllowed(_requester);
	}

	/************************* open / close mechanisms *************************/
	function isOpen() public view returns (bool)
	{
		return m_datasetStatus == DatasetStatusEnum.OPEN;
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

}
