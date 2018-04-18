pragma solidity ^0.4.21;
import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import './IexecCallbackInterface.sol';
import "rlc-token/contracts/RLC.sol";


contract IexecAPI is OwnableOZ, IexecHubAccessor, IexecCallbackInterface
{
	event WorkOrder              (address woid);
	event WithdrawRLCFromIexecAPI(address to,       uint256 amount);
	event ApproveIexecHub        (address iexecHub, uint256 amount);
	event DepositRLCOnIexecHub   (address iexecHub, uint256 amount);
	event WithdrawRLCFromIexecHub(address iexecHub, uint256 amount);

	// Constructor
	function IexecAPI(address _iexecHubAddress)
	IexecHubAccessor(_iexecHubAddress)
	public
	{

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
		emit WorkOrder(woid);
	}

	function workOrderCallback(
		address _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool)
	{
		require(msg.sender == _woid);
		emit WorkOrderCallback(_woid, _stdout, _stderr, _uri);
		return true;
	}

	function approveIexecHub(uint256 amount) public onlyOwner returns (bool)
	{
		RLC rlc = RLC(iexecHubInterface.getRLCAddress());
		require(rlc.approve(iexecHubAddress, amount));
		emit ApproveIexecHub(iexecHubAddress, amount);
		return true;
	}

	function withdrawRLCFromIexecAPI(uint256 amount) public onlyOwner returns (bool)
	{
		RLC rlc = RLC(iexecHubInterface.getRLCAddress());
		require(rlc.transfer(msg.sender, amount));
		emit WithdrawRLCFromIexecAPI(msg.sender, amount);
		return true;
	}

	function depositRLCOnIexecHub(uint256 amount) public onlyOwner returns (bool)
	{
		require(iexecHubInterface.deposit(amount));
		emit DepositRLCOnIexecHub(iexecHubAddress, amount);
		return true;
	}

	function withdrawRLCFromIexecHub(uint256 amount) public onlyOwner returns (bool)
	{
		require(iexecHubInterface.withdraw(amount));
		require(withdrawRLCFromIexecAPI(amount));
		emit WithdrawRLCFromIexecHub(iexecHubAddress, amount);
		return true;
	}



}
