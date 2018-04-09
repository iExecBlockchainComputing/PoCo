pragma solidity ^0.4.21;

import './IexecAPI.sol';
import './IexecLib.sol';
contract WorkOrder
{


	/**
	 * Members
	 */
	IexecLib.WorkOrderStatusEnum public m_status;

	uint256 public m_marketorderIdx;

	address public m_app;
	address public m_dataset;
	address public m_workerpool;
	address public m_requester;

	//uint256 public m_reward;
	uint256 public m_emitcost;
	//uint256 public m_trust;
	string  public m_params;
	address public m_callback;
	address public m_beneficiary;

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
		uint256 _marketorderIdx,
		address _requester,
		address _app,
		address _dataset,
		address _workerpool,
	//	uint256 _reward,
		uint256 _emitcost,
	//	uint256 _trust,
		string  _params,
		address _callback,
		address _beneficiary)
	public
	{
		m_iexecHubAddress = msg.sender;
		require(_requester != address(0));
		m_status         = IexecLib.WorkOrderStatusEnum.ACTIVE;
		m_marketorderIdx = _marketorderIdx;
		m_app            = _app;
		m_dataset        = _dataset;
		m_workerpool     = _workerpool;
		m_requester      = _requester;
		//m_reward         = _reward;//Stack too deep, try removing local variables
		m_emitcost       = _emitcost;//Stack too deep, try removing local variables
		//m_trust          = _trust;
		m_params         = _params;
		m_callback       = _callback;
		m_beneficiary    = _beneficiary;
		// needed for the scheduler to authorize api token access on this m_beneficiary address in case _requester is a smart contract.
	}


	function reveal() public onlyIexecHub
	{
		require(m_status == IexecLib.WorkOrderStatusEnum.ACTIVE);
		m_status = IexecLib.WorkOrderStatusEnum.REVEALING;
	}

	function claim() public onlyIexecHub
	{
		require(m_status == IexecLib.WorkOrderStatusEnum.ACTIVE || m_status == IexecLib.WorkOrderStatusEnum.REVEALING); 
		m_status = IexecLib.WorkOrderStatusEnum.CLAIMED;
	}

	function reactivate() public onlyIexecHub
	{
		require(m_status == IexecLib.WorkOrderStatusEnum.REVEALING);
		m_status = IexecLib.WorkOrderStatusEnum.ACTIVE;
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
			require(IexecAPI(m_callback).workOrderCallback(
				this,
				_stdout,
				_stderr,
				_uri
			));
		}
	}

}
