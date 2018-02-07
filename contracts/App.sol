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
	string        public m_appParam;
	string        public m_appUri;
	AppStatusEnum public m_appStatus;

	/**
	 * Address of slave contracts
	 */
	address       public m_workerPoolsAuthorizedListAddress;
	address       public m_datasetsAuthorizedListAddress;
	address       public m_requestersAuthorizedListAddress;

	/**
	 * Constructor
	 */
	function App(
		address _iexecHubAddress,
		string  _appName,
		uint256 _appPrice,
		string  _appParam,
		string  _appUri)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender == DatasetHub
		require(tx.origin != msg.sender);
		transferOwnership(tx.origin); // owner → tx.origin

		m_appName   = _appName;
		m_appPrice  = _appPrice;
		m_appParam  = _appParam;
		m_appUri    = _appUri;
		m_appStatus = AppStatusEnum.OPEN;
	}

	/**
	 * Methods
	 */
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

	function isOpen() public view returns (bool)
	{
		return m_appStatus == AppStatusEnum.OPEN;
	}

	function attachWorkerPoolsAuthorizedListContract(address _workerPoolsAuthorizedListAddress) public onlyOwner
	{
		m_workerPoolsAuthorizedListAddress = _workerPoolsAuthorizedListAddress;
	}

	function attachDatasetsAuthorizedListContract(address _datasetsAuthorizedListAddress) public onlyOwner
	{
		m_datasetsAuthorizedListAddress = _datasetsAuthorizedListAddress;
	}

	function attachRequestersAuthorizedListContract(address _requestersAuthorizedListAddress) public onlyOwner
	{
		m_requestersAuthorizedListAddress = _requestersAuthorizedListAddress;
	}

	function isWorkerPoolAllowed(address _workerPool) public returns (bool)
	{
		return AuthorizedList(m_workerPoolsAuthorizedListAddress).isActorAllowed(_workerPool);
	}

	function isDatasetAllowed(address _dataset) public returns (bool)
	{
		return AuthorizedList(m_datasetsAuthorizedListAddress).isActorAllowed(_dataset);
	}

	function isRequesterAllowed(address _requester) public returns (bool)
	{
		return AuthorizedList(m_requestersAuthorizedListAddress).isActorAllowed(_requester);
	}

}
