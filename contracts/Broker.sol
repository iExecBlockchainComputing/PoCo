pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./tools/IexecODBLibOrders.sol";
import "./tools/SafeMathOZ.sol";

import "./IexecClerk.sol";

contract Broker
{
	using SafeMathOZ for uint256;

	IexecClerk                  public iexecclerk;
	uint256                     public m_price = 0.01 ether;
	mapping(address => uint256) public m_balance;

	constructor(address _iexecclerk)
	public
	{
		iexecclerk = IexecClerk(_iexecclerk);
	}

	function deposit()
	public payable
	{
		m_balance[msg.sender] = m_balance[msg.sender].add(msg.value);
	}

	function depositFrom(address _account)
	public payable
	{
		m_balance[_account] = m_balance[_account].add(msg.value);
	}

	function withdraw(uint256 _amount)
	public
	{
		m_balance[msg.sender] = m_balance[msg.sender].sub(_amount);
		msg.sender.transfer(_amount);
	}

	function matchOrdersForUser(
		IexecODBLibOrders.DappOrder _dapporder,
		IexecODBLibOrders.DataOrder _dataorder,
		IexecODBLibOrders.PoolOrder _poolorder,
		IexecODBLibOrders.UserOrder _userorder)
	public /* onlyOwner */ returns (bytes32)
	{
		address account = _userorder.requester;
		m_balance[account] = m_balance[account].sub(m_price);
		msg.sender.transfer(m_price);

		return iexecclerk.matchOrders(
			_dapporder,
			_dataorder,
			_poolorder,
			_userorder);
	}

	function matchOrdersForPool(
		IexecODBLibOrders.DappOrder _dapporder,
		IexecODBLibOrders.DataOrder _dataorder,
		IexecODBLibOrders.PoolOrder _poolorder,
		IexecODBLibOrders.UserOrder _userorder)
	public /* onlyOwner */ returns (bytes32)
	{
		address account = Pool(_poolorder.pool).m_owner();
		m_balance[account] = m_balance[account].sub(m_price);
		msg.sender.transfer(m_price);

		return iexecclerk.matchOrders(
			_dapporder,
			_dataorder,
			_poolorder,
			_userorder);
	}

}
