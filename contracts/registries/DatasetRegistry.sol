pragma solidity ^0.5.0;

import './Registry.sol';
import './CounterfactualFactory.sol';
import './Dataset.sol';


contract DatasetRegistry is Registry, CounterfactualFactory
{
	event CreateDataset(address indexed datasetOwner, address dataset);

	/**
	 * Constructor
	 */
	constructor(address _previous)
	public Registry("iExec Dataset Registry (v4)", "iExecDatasetsV4", _previous)
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
	external returns (Dataset)
	{
		Dataset dataset = Dataset(_create2(
			abi.encodePacked(
				type(Dataset).creationCode,
				abi.encode(
					_datasetName,
					_datasetMultiaddr,
					_datasetChecksum
				)
			),
			bytes32(0)
		));

		_mint(_datasetOwner, uint256(address(dataset)));
		emit CreateDataset(_datasetOwner, address(dataset));
		return dataset;
	}
}
