pragma solidity ^0.4.18;

import "./OwnableOZ.sol";
import './IexecHubAccessor.sol';
import './IexecAPI.sol';

contract WorkOrder is OwnableOZ, IexecHubAccessor
{


	enum WorkOrderStatusEnum
	{
		UNSET,
		PENDING,
		ACCEPTED,
		CANCELLED,
		ABORTED,
		COMPLETED
	}

	/**
	 * Members
	 */
	address private m_WorkOrderHubAddress;

	modifier onlyWorkOrderHub()
	{
		require(msg.sender == m_workOrderHubAddress);
		_;
	}

  address private m_workOrderHubAddress;
	address public m_workerPoolRequested;
	address public m_appRequested;
	address public m_datasetRequested;
	string  public m_workOrderParam;
	uint256 public m_workReward;
	uint256 public m_askedTrust;
	bool    public m_dappCallback;
	address public m_beneficiary;

  WorkOrderStatusEnum  public m_status;
	string  public m_stdout;
	string  public m_stderr;
	string  public m_uri;

	/**
	 * Constructor
	 */
	function WorkOrder(
		address _iexecHubAddress,
		address _requester,
		address _workerPool,
		address _app,
		address _dataset,
		string  _workOrderParam,
		uint    _workReward,
		uint    _askedTrust,
		bool    _dappCallback,
		address _beneficiary)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		require(_requester != address(0));
		transferOwnership(_requester); // owner → tx.origin
		m_workOrderHubAddress = msg.sender;
		m_workerPoolRequested   = _workerPool;
		m_appRequested          = _app;
		m_datasetRequested      = _dataset;
		m_workOrderParam        = _workOrderParam;
		m_workReward            = _workReward;
		m_askedTrust            = _askedTrust;
		m_dappCallback          = _dappCallback;
		// needed for the scheduler to authorize api token access on this m_beneficiary address in case _requester is a smart contract.
		m_beneficiary           = _beneficiary;
		m_status                = WorkOrderStatusEnum.PENDING;
	}

	function setAccepted() onlyWorkOrderHub public returns (bool)
	{
		m_status = WorkOrderStatusEnum.ACCEPTED;
		return true;
	}

	function setCancelled() onlyWorkOrderHub  public returns (bool)
	{
		m_status = WorkOrderStatusEnum.CANCELLED;
		return true;
	}

	function setAborted() onlyWorkOrderHub  public returns (bool)
	{
		m_status = WorkOrderStatusEnum.ABORTED;
		return true;
	}

	function setResult(string _stdout, string _stderr, string _uri) onlyWorkOrderHub public returns (bool)
	{
		m_stdout = _stdout;
		m_stderr = _stderr;
		m_uri    = _uri;
		m_status = WorkOrderStatusEnum.COMPLETED;
		if(m_dappCallback)
		{
			// optional dappCallback call can be done
			require(IexecAPI(m_owner).workOrderCallback(
				this,
				_stdout,
				_stderr,
				_uri
			));
		}
		return true;
	}




}
