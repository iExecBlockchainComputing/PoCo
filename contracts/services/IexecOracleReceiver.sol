pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "iexec-solidity/contracts/ERC1154_OracleInterface/IERC1154.sol";

import "../IexecClerk.sol";
import "../IexecHub.sol";
import "../SignatureVerifier.sol";

contract IexecOracleReceiver is Ownable, SignatureVerifier, IOracleConsumer
{
	IexecHub   public m_iexecHub;
	IexecClerk public m_iexecClerk;
	address    public m_authorizedApp;
	address    public m_authorizedDataset;
	address    public m_authorizedWorkerpool;
	bytes32    public m_requiredtag;
	uint256    public m_requiredtrust;

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
		m_iexecHub             = _iexecHub;
		m_iexecClerk           = m_iexecHub.iexecclerk();
	}

	function setEnv(
		address _authorizedApp
	,	address _authorizedDataset
	,	address _authorizedWorkerpool
	, bytes32 _requiredtag
	, uint256 _requiredtrust
	)
	public onlyOwner
	{
		m_authorizedApp        = _authorizedApp;
		m_authorizedDataset    = _authorizedDataset;
		m_authorizedWorkerpool = _authorizedWorkerpool;
		m_requiredtag          = _requiredtag;
		m_requiredtrust        = _requiredtrust;
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
		require(task.status == IexecODBLibCore.TaskStatusEnum.COMPLETED,                                                                                    "result-not-available"             );
		require(task.resultDigest == keccak256(task.results),                                                                                               "result-not-validated-by-consensus");
		require(m_authorizedApp        == address(0) || checkIdentity(m_authorizedApp,        deal.app.pointer,        m_iexecClerk.GROUPMEMBER_PURPOSE()), "unauthorized-app"                 );
		require(m_authorizedDataset    == address(0) || checkIdentity(m_authorizedDataset,    deal.dataset.pointer,    m_iexecClerk.GROUPMEMBER_PURPOSE()), "unauthorized-dataset"             );
		require(m_authorizedWorkerpool == address(0) || checkIdentity(m_authorizedWorkerpool, deal.workerpool.pointer, m_iexecClerk.GROUPMEMBER_PURPOSE()), "unauthorized-workerpool"          );
		require(m_requiredtag & ~deal.tag == bytes32(0),                                                                                                    "invalid-tag"                      );
		require(m_requiredtrust <= deal.trust,                                                                                                              "invalid-trust"                    );
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
