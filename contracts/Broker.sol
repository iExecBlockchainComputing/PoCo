pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./Iexec0xLib.sol";
import "./Marketplace.sol";
import "./tools/SafeMathOZ.sol";

contract Broker
{
	using SafeMathOZ for uint256;

	Marketplace                 public m_marketplace;
	uint256                     public m_price = 0.01 ether;
	mapping(address => uint256) public m_balance;

	constructor(Marketplace _marketplace)
	public
	{
		m_marketplace = _marketplace;
	}

	function deposit()
	payable
	{
		m_balance[msg.sender] = m_balance[msg.sender].add(msg.value);
	}

	function depositFrom(address _account)
	payable
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
		Iexec0xLib.DappOrder _dapporder,
		Iexec0xLib.DataOrder _dataorder,
		Iexec0xLib.PoolOrder _poolorder,
		Iexec0xLib.UserOrder _userorder)
	public /* onlyOwner */ returns (bytes32)
	{
		address account = _userorder.requester;
		m_balance[account] = m_balance[account].sub(m_price);
		msg.sender.transfer(m_price);

		return m_marketplace.matchOrders(
			_dapporder,
			_dataorder,
			_poolorder,
			_userorder);
	}

	function matchOrdersForPool(
		Iexec0xLib.DappOrder _dapporder,
		Iexec0xLib.DataOrder _dataorder,
		Iexec0xLib.PoolOrder _poolorder,
		Iexec0xLib.UserOrder _userorder)
	public /* onlyOwner */ returns (bytes32)
	{
		address account = Pool(_poolorder.pool).m_owner();
		m_balance[account] = m_balance[account].sub(m_price);
		msg.sender.transfer(m_price);

		return m_marketplace.matchOrders(
			_dapporder,
			_dataorder,
			_poolorder,
			_userorder);
	}

}
