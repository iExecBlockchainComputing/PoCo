pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubInterface.sol';

contract Dataset is OwnableOZ, IexecHubInterface
{
	string   public  datasetName;
	uint256  public  datasetPrice;
	string   public  datasetParam;
	string   public  datasetUri;

	//TODO add black and white listing possible by owner
	//TODO add OPEN and CLOSE STATUS for datasetUri maintenance

	//constructor
	function Dataset(
		address _iexecHubAddress,
		string _datasetName,
		uint256 _datasetPrice,
		string _datasetParam,
		string _datasetUri)
	IexecHubInterface(_iexecHubAddress)
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
	}

}
