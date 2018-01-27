pragma solidity ^0.4.18;

import "./SafeMathOZ.sol";
import "rlc-token/contracts/RLC.sol";

/*****************************************************************************
 * Contract ProvidersBalance: ...                                                      *
 *****************************************************************************/
contract ProvidersBalance
{
//	event Deposit(address owner, uint256 amount);
//	event Withdraw(address owner, uint256 amount);
//	event Reward(address user, uint256 amount);
//	event Seize(address user, uint256 amount);
	using SafeMathOZ for uint256;
	/**
	 * Account structure
	 */
	struct Account
	{
		uint256 stake;
		uint256 locked;
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
	function ProvidersBalance(address _tokenAddress) public
	{
		rlc = RLC(_tokenAddress);
	}
	/**
	 * Public functions
	 */
	function deposit(uint256 _amount) public returns (bool)
	{
		// TODO: is the transferFrom cancel is SafeMath throws ?
		require(rlc.transferFrom(msg.sender, address(this), _amount));
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.add(_amount);
		//Deposit(msg.sender,_amount);
		return true;
	}
	function withdraw(uint256 _amount) public returns (bool)
	{
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.sub(_amount);
		// TODO: is the transferFrom cancel is SafeMath throws ?
		require(rlc.transfer(msg.sender, _amount));
		//Withdraw(msg.sender,_amount);
		return true;
	}
	function checkBalance(address _owner) public view returns (uint stake, uint locked)
	{
		return (m_accounts[_owner].stake, m_accounts[_owner].locked);
	}
	/**
	 * Internal function
	 */
	function lock(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = m_accounts[_user].stake.sub(_amount);
		m_accounts[_user].locked = m_accounts[_user].locked.add(_amount);
		return true;
	}
	function unlock(address _user, uint256 _amount) internal returns (bool)
	{
		//TODO check locked is present before sub. and test it
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		m_accounts[_user].stake  = m_accounts[_user].stake.add(_amount);
		return true;
	}
	function reward(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = m_accounts[_user].stake.add(_amount);
	//	Reward(_user,_amount);
		return true;
	}
	function seize (address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
	//	Seize(_user,_amount);
		return true;
	}
	function debit(address _user, uint256 _amount) internal returns (bool)
	{
		if(m_accounts[_user].stake < _amount){
			require(deposit(_amount));
		}
		m_accounts[_user].stake  = m_accounts[_user].stake.sub(_amount);
		return true;
	}

}
