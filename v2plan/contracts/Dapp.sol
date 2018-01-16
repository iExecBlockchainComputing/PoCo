pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubInterface.sol';
import "./AuthorizedList.sol";

contract Dapp is OwnableOZ, IexecHubInterface //Owned by a D(w){
{


	enum DappStatusEnum{OPEN,CLOSE}

	string   public  dappName;
	uint256  public  dappPrice;
	string   public  dappParam;
	string   public  dappUri;

  DappStatusEnum public dappStatus;

	address public workerPoolsAuthorizedListAddress;
	address public datasetsAuthorizedListAddress;
	address public requestersAuthorizedListAddress;


	//constructor
	function Dapp(
		address _iexecHubAddress,
		string  _dappName,
		uint256 _dappPrice,
		string  _dappParam,
		string  _dappUri)
	IexecHubInterface(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender == DatasetHub
		require(tx.origin != msg.sender);
		transferOwnership(tx.origin); // owner → tx.origin

		dappName   = _dappName;
		dappPrice  = _dappPrice;
		dappParam  = _dappParam;
		dappUri    = _dappUri;
		dappStatus = DappStatusEnum.OPEN;
	}

	function open() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(dappStatus == DappStatusEnum.CLOSE);
		dappStatus = DappStatusEnum.OPEN;
		return true;
	}

	function close() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(dappStatus == DappStatusEnum.OPEN);
		dappStatus = DappStatusEnum.CLOSE;
		return true;
	}

	function isOpen() public view returns (bool)
	{
		return dappStatus == DappStatusEnum.OPEN;
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
