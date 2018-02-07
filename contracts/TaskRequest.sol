pragma solidity ^0.4.18;

import "./OwnableOZ.sol";
import './IexecHubAccessor.sol';
import './IexecAPI.sol';

contract TaskRequest is OwnableOZ, IexecHubAccessor
{


	enum TaskRequestStatusEnum
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
	address private m_taskRequestHubAddress;

	modifier onlytaskRequestHub()
	{
		require(msg.sender == m_taskRequestHubAddress);
		_;
	}


	address public m_workerPoolRequested;
	address public m_appRequested;
	address public m_datasetRequested;
	string  public m_taskParam;
	uint256 public m_taskCost;
	uint256 public m_askedTrust;
	bool    public m_dappCallback;

  TaskRequestStatusEnum  public m_status;
	string  public m_stdout;
	string  public m_stderr;
	string  public m_uri;

	/**
	 * Constructor
	 */
	function TaskRequest(
		address _iexecHubAddress,
		address _requester,
		address _workerPool,
		address _app,
		address _dataset,
		string  _taskParam,
		uint    _taskCost,
		uint    _askedTrust,
		bool    _dappCallback)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		require(_requester != address(0));
		transferOwnership(_requester); // owner → tx.origin
		m_taskRequestHubAddress = msg.sender;
		m_workerPoolRequested   = _workerPool;
		m_appRequested          = _app;
		m_datasetRequested      = _dataset;
		m_taskParam             = _taskParam;
		m_taskCost              = _taskCost;
		m_askedTrust            = _askedTrust;
		m_dappCallback          = _dappCallback;
		m_status                = TaskRequestStatusEnum.PENDING;
	}

	function setAccepted() onlytaskRequestHub public returns (bool)
	{
		m_status = TaskRequestStatusEnum.ACCEPTED;
		return true;
	}

	function setCancelled() onlytaskRequestHub  public returns (bool)
	{
		m_status = TaskRequestStatusEnum.CANCELLED;
		return true;
	}

	function setAborted() onlytaskRequestHub  public returns (bool)
	{
		m_status = TaskRequestStatusEnum.ABORTED;
		return true;
	}

	function setResult(string _stdout, string _stderr, string _uri) onlytaskRequestHub public returns (bool)
	{
		m_stdout = _stdout;
		m_stderr = _stderr;
		m_uri    = _uri;
		m_status = TaskRequestStatusEnum.COMPLETED;
		if(m_dappCallback)
		{
			// optional dappCallback call can be done
			require(IexecAPI(m_owner).taskRequestCallback(
				this,
				_stdout,
				_stderr,
				_uri
			));
		}
		return true;
	}




}
