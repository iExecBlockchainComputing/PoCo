pragma solidity ^0.4.18;

import './Closable.sol';
import './IexecHubAccessor.sol';
import "./AuthorizedList.sol";

contract Dataset is Closable, IexecHubAccessor
{

	/**
	 * Members
	 */
	string            public m_datasetName;
	uint256           public m_datasetPrice;
	string            public m_datasetParams;

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

		appsAuthorizedListAddress        = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		requestersAuthorizedListAddress  = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		workerPoolsAuthorizedListAddress = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
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

}
