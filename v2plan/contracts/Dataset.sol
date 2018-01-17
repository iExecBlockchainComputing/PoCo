pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import "./AuthorizedList.sol";

contract Dataset is OwnableOZ, IexecHubAccessor
{


	enum DatasetStatusEnum{OPEN,CLOSE}

	string   public  datasetName;
	uint256  public  datasetPrice;
	string   public  datasetParam;
	string   public  datasetUri;

	DatasetStatusEnum public datasetStatus;

	address public workerPoolsAuthorizedListAddress;
	address public appsAuthorizedListAddress;
	address public requestersAuthorizedListAddress;

	//TODO add OPEN and CLOSE STATUS for datasetUri maintenance

	//constructor
	function Dataset(
		address _iexecHubAddress,
		string _datasetName,
		uint256 _datasetPrice,
		string _datasetParam,
		string _datasetUri)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender == DatasetHub
		require(tx.origin != msg.sender);
		transferOwnership(tx.origin); // owner → tx.origin

		datasetName  = _datasetName;
		datasetPrice = _datasetPrice;
		datasetParam = _datasetParam;
		datasetUri   = _datasetUri;
		datasetStatus= DatasetStatusEnum.OPEN;
	}

	function open() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(datasetStatus == DatasetStatusEnum.CLOSE);
		datasetStatus = DatasetStatusEnum.OPEN;
		return true;
	}

	function close() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(datasetStatus == DatasetStatusEnum.OPEN);
		datasetStatus = DatasetStatusEnum.CLOSE;
		return true;
	}

	function isOpen() public view returns (bool)
	{
		return datasetStatus == DatasetStatusEnum.OPEN;
	}

	function attachWorkerPoolsAuthorizedListContract(address _workerPoolsAuthorizedListAddress) public onlyOwner{
		workerPoolsAuthorizedListAddress =_workerPoolsAuthorizedListAddress;
	}

	function attachAppsAuthorizedListContract(address _appsAuthorizedListAddress) public onlyOwner{
		appsAuthorizedListAddress =_appsAuthorizedListAddress;
	}

	function attachRequestersAuthorizedListContract(address _requestersAuthorizedListAddress) public onlyOwner{
		requestersAuthorizedListAddress =_requestersAuthorizedListAddress;
	}

	function isWorkerPoolAllowed(address _workerPool) public returns (bool)
	{
	  return AuthorizedList(workerPoolsAuthorizedListAddress).isActorAllowed(_workerPool);
	}

	function isAppAllowed(address _app) public returns (bool)
	{
	  return AuthorizedList(appsAuthorizedListAddress).isActorAllowed(_app);
	}

	function isRequesterAllowed(address _requester) public returns (bool)
	{
	  return AuthorizedList(requestersAuthorizedListAddress).isActorAllowed(_requester);
	}



}
