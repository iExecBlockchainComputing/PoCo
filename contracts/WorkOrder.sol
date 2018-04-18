pragma solidity ^0.4.21;

import './IexecCallbackInterface.sol';
import './IexecLib.sol';
contract WorkOrder
{


	event WorkOrderActivated();
	event WorkOrderReActivated();
	event WorkOrderRevealing();
	event WorkOrderClaimed  ();
	event WorkOrderCompleted();

	/**
	 * Members
	 */
	IexecLib.WorkOrderStatusEnum public m_status;

	uint256 public m_category;
	uint256 public m_trust;
	uint256 public m_value;

	address public m_workerpool;
	address public m_workerpoolOwner;

	address public m_app;
	address public m_dataset;
	address public m_callback;
	address public m_beneficiary;
	address public m_requester;
	string  public m_params;

	uint256 public m_emitcost;

	string  public m_stdout;
	string  public m_stderr;
	string  public m_uri;

	address public m_iexecHubAddress;

	modifier onlyIexecHub()
	{
		require(msg.sender == m_iexecHubAddress);
		_;
	}

	/**
	 * Constructor
	 */
	function WorkOrder(
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
		uint256 _emitcost)
	public
	{
		m_iexecHubAddress = msg.sender;
		m_status          = IexecLib.WorkOrderStatusEnum.ACTIVE;
		m_category        = _commonOrder[0];
		m_trust           = _commonOrder[1];
		m_value           = _commonOrder[2];
		m_workerpool      = _poolOrder_workerpool;
		m_workerpoolOwner = _poolOrder_workerpoolOwner;
		m_app             = _userOrder[0];
		m_dataset         = _userOrder[1];
		m_callback        = _userOrder[2];
		m_beneficiary     = _userOrder[3];
		m_requester       = _userOrder[4];
		m_params          = _userOrder_params;
		m_emitcost        = _emitcost;
	}

	function startRevealingPhase() public returns (bool)
	{
		require(m_workerpool == msg.sender);
		require(m_status == IexecLib.WorkOrderStatusEnum.ACTIVE);
		m_status = IexecLib.WorkOrderStatusEnum.REVEALING;
		emit WorkOrderRevealing();
		return true;
	}

	function reActivate() public returns (bool)
	{
		require(m_workerpool == msg.sender);
		require(m_status == IexecLib.WorkOrderStatusEnum.REVEALING);
		m_status = IexecLib.WorkOrderStatusEnum.ACTIVE;
		emit WorkOrderReActivated();
		return true;
	}


	function claim() public onlyIexecHub
	{
		require(m_status == IexecLib.WorkOrderStatusEnum.ACTIVE || m_status == IexecLib.WorkOrderStatusEnum.REVEALING);
		m_status = IexecLib.WorkOrderStatusEnum.CLAIMED;
		emit WorkOrderClaimed();
	}


	function setResult(string _stdout, string _stderr, string _uri) public onlyIexecHub
	{
		require(m_status == IexecLib.WorkOrderStatusEnum.REVEALING);
		m_status = IexecLib.WorkOrderStatusEnum.COMPLETED;
		m_stdout = _stdout;
		m_stderr = _stderr;
		m_uri    = _uri;
		if (m_callback != address(0))
		{
			// optional dappCallback call can be done
			require(IexecCallbackInterface(m_callback).workOrderCallback(
				this,
				_stdout,
				_stderr,
				_uri
			));
		}
		emit WorkOrderCompleted();
	}

}
