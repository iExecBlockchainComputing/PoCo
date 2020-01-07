pragma solidity ^0.5.0;

import './Registry.sol';
import './Dataset.sol';


contract DatasetRegistry is Registry
{
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
	function _creationCode()
	internal pure returns (bytes memory)
	{
		return type(Dataset).creationCode;
	}

	function createDataset(
		address          _datasetOwner,
		string  calldata _datasetName,
		bytes   calldata _datasetMultiaddr,
		bytes32          _datasetChecksum)
	external returns (Dataset)
	{
		return Dataset(_mintCreate(
			_datasetOwner,
			abi.encode(
				_datasetName,
				_datasetMultiaddr,
				_datasetChecksum
			)
		));
	}
}
