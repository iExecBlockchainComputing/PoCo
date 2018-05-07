pragma solidity ^0.4.21;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';

contract Dataset is OwnableOZ, IexecHubAccessor
{

	/**
	 * Members
	 */
	string            public m_datasetName;
	uint256           public m_datasetPrice;
	string            public m_datasetParams;

	/**
	 * Constructor
	 */
	function Dataset(
		address _iexecHubAddress,
		string  _datasetName,
		uint256 _datasetPrice,
		string  _datasetParams)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender == DatasetHub
		require(tx.origin != msg.sender);
		setImmutableOwnership(tx.origin); // owner → tx.origin

		m_datasetName   = _datasetName;
		m_datasetPrice  = _datasetPrice;
		m_datasetParams = _datasetParams;

	}


}
