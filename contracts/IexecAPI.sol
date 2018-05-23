pragma solidity ^0.4.21;
import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import './IexecCallbackInterface.sol';
import "rlc-token/contracts/RLC.sol";


contract IexecAPI is OwnableOZ, IexecHubAccessor, IexecCallbackInterface
{
	event WorkOrderActivated     (address woid);
	event WithdrawRLCFromIexecAPI(address to,       uint256 amount);
	event ApproveIexecHub        (address iexecHub, uint256 amount);
	event DepositRLCOnIexecHub   (address iexecHub, uint256 amount);
	event WithdrawRLCFromIexecHub(address iexecHub, uint256 amount);

	address public m_callbackProofAddress;

	// Constructor
	function IexecAPI(address _iexecHubAddress, address _callbackProofAddress)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		m_callbackProofAddress = _callbackProofAddress;
	}

	function buyForWorkOrder(
		uint256 _marketorderIdx,
		address _workerpool,
		address _app,
		address _dataset,
		string  _params,
		address _callback,
		address _beneficiary)
	public
	{
		address woid = iexecHubInterface.buyForWorkOrder(_marketorderIdx, _workerpool, _app, _dataset, _params, _callback, _beneficiary);
		emit WorkOrderActivated(woid);
	}

	function workOrderCallback(
		address _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool)
	{
		require(msg.sender == m_callbackProofAddress);
		emit WorkOrderCallback(_woid, _stdout, _stderr, _uri);
		return true;
	}

	function approveIexecHub(uint256 amount) public onlyOwner returns (bool)
	{
		RLC rlc = iexecHubInterface.rlc();
		require(rlc.approve(address(iexecHubInterface), amount));
		emit ApproveIexecHub(address(iexecHubInterface), amount);
		return true;
	}

	function withdrawRLCFromIexecAPI(uint256 amount) public onlyOwner returns (bool)
	{
		RLC rlc = iexecHubInterface.rlc();
		require(rlc.transfer(msg.sender, amount));
		emit WithdrawRLCFromIexecAPI(msg.sender, amount);
		return true;
	}

	function depositRLCOnIexecHub(uint256 amount) public onlyOwner returns (bool)
	{
		require(iexecHubInterface.deposit(amount));
		emit DepositRLCOnIexecHub(address(iexecHubInterface), amount);
		return true;
	}

	function withdrawRLCFromIexecHub(uint256 amount) public onlyOwner returns (bool)
	{
		require(iexecHubInterface.withdraw(amount));
		require(withdrawRLCFromIexecAPI(amount));
		emit WithdrawRLCFromIexecHub(address(iexecHubInterface), amount);
		return true;
	}



}
