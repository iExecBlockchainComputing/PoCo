pragma solidity ^0.5.0;

import './Dataset.sol';
import './CounterfactualFactory.sol';
import './RegistryBase.sol';


contract DatasetRegistry is CounterfactualFactory, RegistryBase, ENSReverseRegistrationOwnable
{
	event CreateDataset(address indexed datasetOwner, address dataset);

	/**
	 * Constructor
	 */
	constructor(address _previous)
	public RegistryBase(_previous)
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
		bytes32 salt = keccak256(abi.encodePacked(
			_datasetName,
			_datasetMultiaddr,
			_datasetChecksum
		));

		Dataset dataset = Dataset(_create2(type(Dataset).creationCode, salt));
		dataset.setup(
			_datasetOwner,
			_datasetName,
			_datasetMultiaddr,
			_datasetChecksum
		);

		insert(address(dataset), _datasetOwner);
		emit CreateDataset(_datasetOwner, address(dataset));
		return dataset;
	}
}
