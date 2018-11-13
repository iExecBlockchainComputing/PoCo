pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import "./tools/IexecODBLibOrders.sol";
import "./tools/SafeMathOZ.sol";

import "./IexecClerk.sol";

contract Broker
{
	using SafeMathOZ for uint256;

	IexecClerk                  public iexecclerk;
	mapping(address => uint256) public m_balance;
	mapping(address => uint256) public m_reward;

	constructor(address _iexecclerk)
	public
	{
		iexecclerk = IexecClerk(_iexecclerk);
	}

	function ()
	public payable
	{
		m_balance[msg.sender] = m_balance[msg.sender].add(msg.value);
	}

	function deposit()
	public payable
	{
		m_balance[msg.sender] = m_balance[msg.sender].add(msg.value);
	}

	function depositFor(address _account)
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

	function setReward(uint256 _reward)
	public
	{
		m_reward[msg.sender] = _reward;
	}

	function matchOrdersForPool(
		IexecODBLibOrders.DappOrder _dapporder,
		IexecODBLibOrders.DataOrder _dataorder,
		IexecODBLibOrders.PoolOrder _poolorder,
		IexecODBLibOrders.UserOrder _userorder)
	public returns (bytes32)
	{
		address account = Pool(_poolorder.pool).m_owner();
		uint256 price   = tx.gasprice * 750000 + m_reward[account];
		m_balance[account] = m_balance[account].sub(price);
		msg.sender.transfer(price);

		return iexecclerk.matchOrders(
			_dapporder,
			_dataorder,
			_poolorder,
			_userorder);
	}

	function matchOrdersForUser(
		IexecODBLibOrders.DappOrder _dapporder,
		IexecODBLibOrders.DataOrder _dataorder,
		IexecODBLibOrders.PoolOrder _poolorder,
		IexecODBLibOrders.UserOrder _userorder)
	public returns (bytes32)
	{
		address account = _userorder.requester;
		uint256 price   = tx.gasprice * 750000 + m_reward[account];
		m_balance[account] = m_balance[account].sub(price);
		msg.sender.transfer(price);

		return iexecclerk.matchOrders(
			_dapporder,
			_dataorder,
			_poolorder,
			_userorder);
	}

	function matchOrdersForPool_v2(
		IexecODBLibOrders.DappOrder _dapporder,
		IexecODBLibOrders.DataOrder _dataorder,
		IexecODBLibOrders.PoolOrder _poolorder,
		IexecODBLibOrders.UserOrder _userorder)
	public returns (bytes32)
	{
		uint256 gasBefore = gasleft();

		bytes32 dealid = iexecclerk.matchOrders(
			_dapporder,
			_dataorder,
			_poolorder,
			_userorder);

		address payer = Pool(_poolorder.pool).m_owner();
		uint256 price = tx.gasprice * (87000 + gasBefore - gasleft()) + m_reward[payer];
		m_balance[payer] = m_balance[payer].sub(price);
		msg.sender.transfer(price);

		return dealid;
	}

	function matchOrdersForUser_v2(
		IexecODBLibOrders.DappOrder _dapporder,
		IexecODBLibOrders.DataOrder _dataorder,
		IexecODBLibOrders.PoolOrder _poolorder,
		IexecODBLibOrders.UserOrder _userorder)
	public returns (bytes32)
	{
		uint256 gasBefore = gasleft();

		bytes32 dealid = iexecclerk.matchOrders(
			_dapporder,
			_dataorder,
			_poolorder,
			_userorder);

		address payer = _userorder.requester;
		uint256 price = tx.gasprice * (87000 + gasBefore - gasleft()) + m_reward[payer];
		m_balance[payer] = m_balance[payer].sub(price);
		msg.sender.transfer(price);

		return dealid;
	}


}
