pragma solidity ^0.4.18;

import './Closable.sol';
import './IexecHubAccessor.sol';
import "./AuthorizedList.sol";

contract App is Closable, IexecHubAccessor // Owned by a D(w)
{

	/**
	 * Members
	 */
	string        public m_appName;
	uint256       public m_appPrice;
	string        public m_appParams;

	/**
	 * Address of slave contracts
	 */
	AuthorizedList public datasetsAuthorizedListAddress;
	AuthorizedList public requestersAuthorizedListAddress;
	AuthorizedList public workerPoolsAuthorizedListAddress;

	/**
	 * Constructor
	 */
	function App(
		address _iexecHubAddress,
		string  _appName,
		uint256 _appPrice,
		string  _appParams)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender == DatasetHub
		require(tx.origin != msg.sender);
		transferOwnership(tx.origin); // owner → tx.origin

		m_appName   = _appName;
		m_appPrice  = _appPrice;
		m_appParams = _appParams;

		datasetsAuthorizedListAddress    = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		requestersAuthorizedListAddress  = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		workerPoolsAuthorizedListAddress = new AuthorizedList(AuthorizedList.ListPolicyEnum.BLACKLIST);
		datasetsAuthorizedListAddress.transferOwnership(tx.origin); // owner → tx.origin
		requestersAuthorizedListAddress.transferOwnership(tx.origin); // owner → tx.origin
		workerPoolsAuthorizedListAddress.transferOwnership(tx.origin); // owner → tx.origin
	}

	/************************ AuthorizedList accessors *************************/
	function isWorkerPoolAllowed(address _workerPool) public view returns (bool)
	{
		return workerPoolsAuthorizedListAddress.isActorAllowed(_workerPool);
	}
	function isDatasetAllowed(address _dataset) public view returns (bool)
	{
		return datasetsAuthorizedListAddress.isActorAllowed(_dataset);
	}
	function isRequesterAllowed(address _requester) public view returns (bool)
	{
		return requestersAuthorizedListAddress.isActorAllowed(_requester);
	}

}
