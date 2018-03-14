pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import "./AuthorizedList.sol";

contract App is OwnableOZ, IexecHubAccessor // Owned by a D(w)
{

	enum AppStatusEnum { OPEN, CLOSE }

	/**
	 * Members
	 */
	string        public m_appName;
	uint256       public m_appPrice;
	string        public m_appParams;
	AppStatusEnum public m_appStatus;

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
		m_appStatus = AppStatusEnum.OPEN;

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

	/************************* open / close mechanisms *************************/
	function isOpen() public view returns (bool)
	{
		return m_appStatus == AppStatusEnum.OPEN;
	}
	function open() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(m_appStatus == AppStatusEnum.CLOSE);
		m_appStatus = AppStatusEnum.OPEN;
		return true;
	}
	function close() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(m_appStatus == AppStatusEnum.OPEN);
		m_appStatus = AppStatusEnum.CLOSE;
		return true;
	}

}
