pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "iexec-solidity/contracts/ERC1154_OracleInterface/IERC1154.sol";

import "../IexecClerk.sol";
import "../IexecHub.sol";


contract IexecOracleReceiver is IOracleConsumer
{
	IexecHub   public m_iexecHub;
	IexecClerk public m_iexecClerk;

	struct timedValue
	{
		uint256 date;
		string  details;
		uint256 value;
	}
	mapping(bytes32 => timedValue) public values;

	event ResultReady(bytes32 indexed oracleCallId);
	event ValueChange(bytes32 indexed id, uint256 oldDate, uint256 oldValue, uint256 newDate, uint256 newValue);

	constructor(IexecHub _iexecHub)
	public
	{
		m_iexecHub   = _iexecHub;
		m_iexecClerk = m_iexecHub.iexecclerk();
	}

	function receiveResult(bytes32 _oracleCallId, bytes calldata)
	external
	{
		emit ResultReady(_oracleCallId);
	}

	function filter(
		IexecODBLibCore.Task memory task,
		IexecODBLibCore.Deal memory deal
	)
	internal returns (bool)
	{
		require(task.status == IexecODBLibCore.TaskStatusEnum.COMPLETED, "result-not-available");
		require(task.resultDigest == keccak256(task.results), "result-not-validated-by-consensus");
		// require(m_whitelist[deal.app.pointer]);
		// require(m_whitelist[deal.dataset.pointer]);
		// require(m_whitelist[deal.workerpool.pointer]);
		return true;
	}

	function processResult(bytes32 _oracleCallId)
	public
	{
		IexecODBLibCore.Task memory task = m_iexecHub.viewTask(_oracleCallId);
		IexecODBLibCore.Deal memory deal = m_iexecClerk.viewDeal(task.dealid);
		require(filter(task, deal));

		// Parse params
		// ... not possible until params switch from string to bytes ...

		// Parse results
		uint256       date;
		string memory details;
		uint256       value;
		(date, details, value) = decodeResults(task.results);

		// Process results
		bytes32 id = keccak256(bytes(details));
		if (values[id].date < date)
		{
			emit ValueChange(id, values[id].date, values[id].value, date, value);
			values[id].date    = date;
			values[id].details = details;
			values[id].value   = value;
		}
	}

	// function encodeParams(uint256 date, bytes memory details) public view returns(string memory)
	// { return string(abi.encode(date, details)); }
	//
	// function decodeParams(string memory params) public view returns(uint256, string memory)
	// { return abi.decode(bytes(params), (uint256, string)); }
	//
	// function encodeResult(uint256 date, string memory details, uint256 value) public view returns(bytes memory)
	// { return abi.encode(date, details, value); }

	function decodeResults(bytes memory results) public view returns(uint256, string memory, uint256)
 	{ return abi.decode(results, (uint256, string, uint256)); }

}
