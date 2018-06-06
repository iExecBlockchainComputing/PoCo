pragma solidity ^0.4.21;

import './WorkOrder.sol';
import "./OwnableOZ.sol";
import "./SafeMathOZ.sol";

contract WorkOrderFactory is OwnableOZ
{

	using SafeMathOZ for uint256;

	/**
	 * Data
	 */
	mapping(address => bool) public m_workorders;

	/**
	 * Constructor
	 */
	function WorkOrderFactory()
	public
	{
	}

	/**
	 * Methods
	 */
	function createWorkOrder(
		/********** Order settings **********/
		uint256[3] _commonOrder,
		/* uint256 _commonOrder_category, */
		/* uint256 _commonOrder_trust, */
		/* uint256 _commonOrder_value, */
		/********** Pool settings **********/
		/* uint256 _poolOrder_volume, */ // NOT NEEDED
		address _poolOrder_workerpool,
		address _poolOrder_workerpoolOwner,
		/********** User settings **********/
		address[5] _userOrder,
		/* address _userOrder_app, */
		/* address _userOrder_dataset, */
		/* address _userOrder_callback, */
		/* address _userOrder_beneficiary, */
		/* address _userOrder_requester, */
		string  _userOrder_params,
		/********** Extra **********/
		uint256 _appPayment)
	public onlyOwner returns (WorkOrder)
	{
		WorkOrder workorder = new WorkOrder(
			_commonOrder,
			_poolOrder_workerpool,
			_poolOrder_workerpoolOwner,
			_userOrder,
			_userOrder_params,
			_appPayment
		);
		workorder.transferOwnership(m_owner); // ownership to iExecHub

		m_workorders[workorder] = true;

		return workorder;
	}

	/*
	function eraseWorkOrder(address _woid)
	public onlyOwner
	{
		m_workorders[_woid] = false;
	}
	*/

	function isValid(address _woid)
	public view returns (bool)
	{
		return m_workorders[_woid];
	}

}
