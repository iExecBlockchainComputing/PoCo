pragma solidity ^0.4.18;

import "rlc-token/contracts/SafeMath.sol";
import "rlc-token/contracts/RLC.sol";

/*****************************************************************************
 * Contract Stake: ...                                                      *
 *****************************************************************************/
contract Stake is SafeMath
{
  /**
	 * Account structure
	 */
	struct Account
	{
		uint stake;
		uint locked;
	}
	/**
	 * Internal data: address to account mapping
	 */
	mapping(address => Account) public m_accounts;
	/**
	 * RLC contract for token transfers.
	 */
	RLC public rlc;
	/**
	 * Constructor
	 */
	function Stake(address _tokenAddress) public
	{
		rlc = RLC(_tokenAddress);
	}
	/**
	 * Public functions
	 */
	function deposit(uint _amount) public returns (bool)
	{
		// TODO: is the transferFrom cancel is SafeMath throws ?
		require(rlc.transferFrom(msg.sender, address(this), _amount));
		m_accounts[msg.sender].stake = safeAdd(m_accounts[msg.sender].stake, msg.value);
		return true;
	}
	function withdraw(uint _amount) public returns (bool)
	{
		// TODO: is the transferFrom cancel is SafeMath throws ?
		require(rlc.transfer(msg.sender, _amount));
		m_accounts[msg.sender].stake = safeSub(m_accounts[msg.sender].stake, msg.value);
		return true;
	}
	function checkBalance() public view returns (uint, uint)
	{
		return (m_accounts[msg.sender].stake, m_accounts[msg.sender].locked);
	}
	/**
	 * Internal function
	 */
	function lock  (address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = safeSub(m_accounts[_user].stake,  _amount);
		m_accounts[_user].locked = safeAdd(m_accounts[_user].locked, _amount);
		return true;
	}
	function unlock(address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].locked = safeSub(m_accounts[_user].locked, _amount);
		m_accounts[_user].stake  = safeAdd(m_accounts[_user].stake,  _amount);
		return true;
	}
	function reward(address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = safeAdd(m_accounts[_user].stake,  _amount);
		return true;
	}
	function seize (address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].locked = safeSub(m_accounts[_user].locked, _amount);
		return true;
	}
  function debit(address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = safeSub(m_accounts[_user].stake,  _amount);
		return true;
	}

}
