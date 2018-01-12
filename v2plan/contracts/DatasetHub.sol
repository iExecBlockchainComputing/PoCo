pragma solidity ^0.4.18;

import "./Dataset.sol";
import "./OwnableOZ.sol";
import "./SafeMathOZ.sol";

contract DatasetHub is OwnableOZ // is Owned by IexecHub
{
	using SafeMathOZ for uint256;

	event CreateDataset(address indexed datasetOwner, address indexed dataset, string datasetName, uint256 datasetPrice, string datasetParam, string datasetUri);

	// owner => datasets count
	mapping (address => uint256) m_datasetsCountByOwner;

	// owner => index => dataset
	mapping (address => mapping (uint256 => address)) m_datasetByOwnerByIndex;

	//  dataset => owner
	mapping (address => address) m_ownerByDataset;

	/**
	 * Explicit constructor !
	 */
	function DatasetHub() OwnableOZ(msg.sender) public
	{
	}

	/**
	 * Methods
	 */
	function getDatasetsCount(address _owner) public view returns (uint256)
	{
		return m_datasetsCountByOwner[_owner];
	}

	function getDataset(address _owner,uint256 _index) public view returns (address)
	{
		return m_datasetByOwnerByIndex[_owner][_index];
	}

	function getDatasetOwner(address _dataset) public view returns (address)
	{
		return m_ownerByDataset[_dataset];
	}

	function isDatasetRegistred(address _dataset) public view returns (bool)
	{
		return m_ownerByDataset[_dataset] != 0x0;
	}

	function createDataset(string _datasetName, uint256 _datasetPrice, string _datasetParam, string _datasetUri) public onlyOwner /*owner == IexecHub*/ returns(address createdDataset)
	{
		// tx.origin == owner
		// msg.sender == IexecHub
		address newDataset = new Dataset(msg.sender,_datasetName, _datasetPrice, _datasetParam, _datasetUri);
		m_datasetsCountByOwner[tx.origin]=m_datasetsCountByOwner[tx.origin].add(1);
		m_datasetByOwnerByIndex[tx.origin][m_datasetsCountByOwner[tx.origin]] = newDataset;
		m_ownerByDataset[newDataset]= tx.origin;
		CreateDataset(tx.origin,newDataset ,_datasetName, _datasetPrice, _datasetParam, _datasetUri);
		return newDataset;
	}

	function getDatasetPrice(address _dataset) public view returns(uint256 datasetPrice)
	{
		Dataset dataset = Dataset(_dataset);
		return dataset.datasetPrice();
	}

}
