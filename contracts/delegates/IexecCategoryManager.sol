pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";


interface IexecCategoryManager
{
	event CreateCategory(uint256 catid, string  name, string  description, uint256 workClockTimeRef);

	function createCategory(string calldata,string calldata,uint256) external returns (uint256);
}

contract IexecCategoryManagerDelegate is IexecCategoryManager, DelegateBase
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
		)) - 1;

		emit CreateCategory(
			catid,
			name,
			description,
			workClockTimeRef
		);
		return catid;
	}
}
