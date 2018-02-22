pragma solidity ^0.4.18;

import "./WorkOrder.sol";
import "./OwnableOZ.sol";
import "./SafeMathOZ.sol";

contract WorkOrderHub is OwnableOZ // is Owned by IexecHub
{

	using SafeMathOZ for uint256;

	/**
	 * Members
	 */
	mapping(address => uint256)                  m_workOrderCountByOwner;
	mapping(address => mapping(uint => address)) m_workOrderByOwnerByIndex;
	mapping(address => address)                  m_ownerByWorkOrder;

	/**
	 * Events
	 */
	event CreateWorkOrder(
		address workOrderOwner,
		address workOrder,
		address indexed workerPool,
		address indexed app,
		address indexed dataset,
		string  workOrderParam,
		uint    workReward,
		uint    askedTrust,
		bool    dappCallback
	);

	/**
	 * Constructor
	 */
	function WorkOrderHub() public
	{
	}

	/**
	 * Methods
	 */
	function getWorkOrdersCount(address _owner) public view returns (uint256)
	{
		return m_workOrderCountByOwner[_owner];
	}

	function getWorkOrder(address _owner, uint256 _index) public view returns (address)
	{
		return m_workOrderByOwnerByIndex[_owner][_index];
	}

	function getWorkOrderOwner(address _workOrder) public view returns (address)
	{
		return m_ownerByWorkOrder[_workOrder];
	}
	// TODO: used ?
	function isWorkOrderRegistred(address _workOrder) public view returns (bool)
	{
		return m_ownerByWorkOrder[_workOrder] != 0x0;
	}

	function addWorkOrder(address _owner, address _workOrder) internal
	{
		uint id = m_workOrderCountByOwner[_owner];
		m_workOrderCountByOwner  [_owner]     = id.add(1);
		m_workOrderByOwnerByIndex[_owner][id] = _workOrder;
		m_ownerByWorkOrder       [_workOrder] = _owner;
	}

	/*
	function getWorkReward(address _woid) public view returns (uint256 workReward)
	{
		return WorkOrder(_woid).m_workReward();
	}

	function getStatus(address _woid) public view returns (IexecLib.WorkOrderStatusEnum status)
	{
		return WorkOrder(_woid).m_status();
	}
	*/
}
