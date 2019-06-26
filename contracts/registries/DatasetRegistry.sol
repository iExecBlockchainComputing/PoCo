pragma solidity ^0.5.9;

import './Dataset.sol';
import './RegistryBase.sol';

contract DatasetRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreateDataset(address indexed datasetOwner, address dataset);

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
		address          _datasetOwner,
		string  calldata _datasetName,
		bytes   calldata _datasetMultiaddr,
		bytes32          _datasetChecksum)
	external /* onlyOwner /*owner == IexecHub*/ returns (Dataset)
	{
		Dataset newDataset = new Dataset(
			_datasetOwner,
			_datasetName,
			_datasetMultiaddr,
			_datasetChecksum
		);
		require(insert(address(newDataset), _datasetOwner));
		emit CreateDataset(_datasetOwner, address(newDataset));
		return newDataset;
	}
}
