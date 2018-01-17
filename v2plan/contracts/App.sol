pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import "./AuthorizedList.sol";

contract App is OwnableOZ, IexecHubAccessor //Owned by a D(w){
{


	enum AppStatusEnum{OPEN,CLOSE}

	string   public  appName;
	uint256  public  appPrice;
	string   public  appParam;
	string   public  appUri;

  AppStatusEnum public appStatus;

	address public workerPoolsAuthorizedListAddress;
	address public datasetsAuthorizedListAddress;
	address public requestersAuthorizedListAddress;


	//constructor
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

		appName   = _appName;
		appPrice  = _appPrice;
		appParam  = _appParam;
		appUri    = _appUri;
		appStatus = AppStatusEnum.OPEN;
	}

	function open() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(appStatus == AppStatusEnum.CLOSE);
		appStatus = AppStatusEnum.OPEN;
		return true;
	}

	function close() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(appStatus == AppStatusEnum.OPEN);
		appStatus = AppStatusEnum.CLOSE;
		return true;
	}

	function isOpen() public view returns (bool)
	{
		return appStatus == AppStatusEnum.OPEN;
	}

	function attachWorkerPoolsAuthorizedListContract(address _workerPoolsAuthorizedListAddress) public onlyOwner{
		workerPoolsAuthorizedListAddress =_workerPoolsAuthorizedListAddress;
	}

	function attachDatasetsAuthorizedListContract(address _datasetsAuthorizedListAddress) public onlyOwner{
		datasetsAuthorizedListAddress =_datasetsAuthorizedListAddress;
	}

	function attachRequestersAuthorizedListContract(address _requestersAuthorizedListAddress) public onlyOwner{
		requestersAuthorizedListAddress =_requestersAuthorizedListAddress;
	}

	function isWorkerPoolAllowed(address _workerPool) public returns (bool)
	{
		return AuthorizedList(workerPoolsAuthorizedListAddress).isActorAllowed(_workerPool);
	}

	function isDatasetAllowed(address _dataset) public returns (bool)
	{
		return AuthorizedList(datasetsAuthorizedListAddress).isActorAllowed(_dataset);
	}

	function isRequesterAllowed(address _requester) public returns (bool)
	{
		return AuthorizedList(requestersAuthorizedListAddress).isActorAllowed(_requester);
	}

}
