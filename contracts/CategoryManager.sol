pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import "./libs/IexecODBLibCore.sol";
import "./tools/Ownable.sol";

contract CategoryManager is OwnableMutable
{
	/**
	 * Content
	 */
	IexecODBLibCore.Category[] m_categories;

	/**
	 * Event
	 */
	event CreateCategory(
		uint256 catid,
		string  name,
		string  description,
		uint256 workClockTimeRef);

	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	/**
	 * Accessors
	 */
	function viewCategory(uint256 _catid)
	public view returns (IexecODBLibCore.Category)
	{
		return m_categories[_catid];
	}

	function countCategory()
	public view returns (uint256)
	{
		return m_categories.length;
	}

	/**
	 * Methods
	 */
	function createCategory(
		string  name,
		string  description,
		uint256 workClockTimeRef)
	public onlyOwner returns (uint256)
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
	/**
	 * TODO: move to struct based initialization ?
	 *
	function createCategory(IexecODBLib.Category _category)
	public onlyOwner returns (uint256)
	{
		uint256 catid = m_categories.push(_category);
		emit CreateCategory(
			catid,
			_category.name,
			_category.description,
			_category.workClockTimeRef
		);
		return catid;
	}
	*/

}
