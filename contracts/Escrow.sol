pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "rlc-token/contracts/RLC.sol";

import "./IexecODBLib.sol";
import "./tools/SafeMathOZ.sol";

contract Escrow
{
	using SafeMathOZ for uint256;

	/**
	* RLC contract for token transfers.
	*/
	RLC public rlc;

	/**
	 * Escrow content
	 */
	mapping(address => IexecODBLib.Account) public m_accounts;

	/**
	 * Events
	 */
	event Deposit (address owner, uint256 amount);
	event Withdraw(address owner, uint256 amount);
	event Reward  (address user,  uint256 amount);
	event Seize   (address user,  uint256 amount);

	/**
	 * Constructor
	 */
	constructor(address _rlctoken)
	public
	{
		require(_rlctoken != address(0));
		rlc = RLC(_rlctoken);
	}

	/**
	 * Accessor
	 */
	function viewAccount(address _user)
	public view returns (IexecODBLib.Account)
	{
		return m_accounts[_user];
	}

	function viewAccountLegacy(address _user)
	public view returns (uint256 stake, uint256 locked)
	{
		return ( m_accounts[_user].stake, m_accounts[_user].locked );
	}

	/**
	 * Wallet methods: public
	 */
	function deposit(uint256 _amount) external returns (bool)
	{
		require(rlc.transferFrom(msg.sender, address(this), _amount));
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.add(_amount);
		emit Deposit(msg.sender, _amount);
		return true;
	}
	function withdraw(uint256 _amount) external returns (bool)
	{
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.sub(_amount);
		require(rlc.transfer(msg.sender, _amount));
		emit Withdraw(msg.sender, _amount);
		return true;
	}
	/**
	 * Wallet methods: Internal
	 */
	function reward(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].stake = m_accounts[_user].stake.add(_amount);
		emit Reward(_user, _amount);
		return true;
	}
	function seize(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		emit Seize(_user, _amount);
		return true;
	}
	function lock(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = m_accounts[_user].stake.sub(_amount);
		m_accounts[_user].locked = m_accounts[_user].locked.add(_amount);
		return true;
	}
	function unlock(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		m_accounts[_user].stake  = m_accounts[_user].stake.add(_amount);
		return true;
	}
}
