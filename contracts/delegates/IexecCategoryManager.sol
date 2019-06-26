pragma solidity ^0.5.9;
pragma experimental ABIEncoderV2;

import "../IexecStore.sol";


interface IexecCategoryManager
{
	event CreateCategory(
		uint256 catid,
		string  name,
		string  description,
		uint256 workClockTimeRef);

	function createCategory(string calldata name, string calldata description, uint256 workClockTimeRef) external returns (uint256);
}

contract IexecCategoryManagerDelegate is IexecCategoryManager, IexecStore
{
	/**
	 * Methods
	 */
	function createCategory(
		string  calldata name,
		string  calldata description,
		uint256          workClockTimeRef)
	external onlyOwner returns (uint256)
	{
		uint256 catid = m_categories.push(IexecODBLibCore.Category(
			name,
			description,
			workClockTimeRef
		));
		emit CreateCategory(
			catid,
			name,
			description,
			workClockTimeRef
		);
		return catid;
	}
}
