pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import './Dataset.sol';
import './RegistryBase.sol';

contract DatasetRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreateDataset(
		address indexed datasetOwner,
		address         dataset,
		string          datasetName,
		string          datasetParams,
		bytes32         datasetHash);

	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	/**
	 * Dataset creation
	 */
	function createDataset(
		address _datasetOwner,
		string  _datasetName,
		string  _datasetParams,
		bytes32 _datasetHash)
	public /* onlyOwner /*owner == IexecHub*/ returns (Dataset)
	{
		Dataset newDataset = new Dataset(_datasetOwner, _datasetName, _datasetParams, _datasetHash);
		require(insert(newDataset, _datasetOwner));
		emit CreateDataset(_datasetOwner, newDataset, _datasetName, _datasetParams, _datasetHash);
		return newDataset;
	}
}
