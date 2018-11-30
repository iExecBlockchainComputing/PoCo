pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

// required for deployment
import "../node_modules/rlc-faucet-contract/contracts/RLC.sol";

import "./interfaces/ERC20.sol";
import "./libs/IexecODBLibCore.sol";
import "./libs/SafeMathOZ.sol";

contract Escrow
{
	using SafeMathOZ for uint256;

	/**
	* token contract for transfers.
	*/
	IERC20 public token;

	/**
	 * Escrow content
	 */
	mapping(address => IexecODBLibCore.Account) m_accounts;

	/**
	 * Events
	 */
	event Deposit   (address owner, uint256 amount);
	event DepositFor(address owner, uint256 amount, address target);
	event Withdraw  (address owner, uint256 amount);
	event Reward    (address user,  uint256 amount);
	event Seize     (address user,  uint256 amount);

	/**
	 * Constructor
	 */
	constructor(address _token)
	public
	{
		token = IERC20(_token);
	}

	/**
	 * Accessor
	 */
	function viewAccount(address _user)
	public view returns (IexecODBLibCore.Account memory account)
	{
		return m_accounts[_user];
	}

	/**
	 * Wallet methods: public
	 */
	function deposit(uint256 _amount) external returns (bool)
	{
		require(token.transferFrom(msg.sender, address(this), _amount));
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.add(_amount);
		emit Deposit(msg.sender, _amount);
		return true;
	}
	function depositFor(uint256 _amount, address _target) external returns (bool)
	{
		require(_target != address(0));
		
		require(token.transferFrom(msg.sender, address(this), _amount));
		m_accounts[_target].stake = m_accounts[_target].stake.add(_amount);
		emit DepositFor(msg.sender, _amount, _target);
		return true;
	}
	function withdraw(uint256 _amount) external returns (bool)
	{
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.sub(_amount);
		require(token.transfer(msg.sender, _amount));
		emit Withdraw(msg.sender, _amount);
		return true;
	}
	/**
	 * Wallet methods: Internal
	 */
	function reward(address _user, uint256 _amount) internal /* returns (bool) */
	{
		m_accounts[_user].stake = m_accounts[_user].stake.add(_amount);
		emit Reward(_user, _amount);
		/* return true; */
	}
	function seize(address _user, uint256 _amount) internal /* returns (bool) */
	{
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		emit Seize(_user, _amount);
		/* return true; */
	}
	function lock(address _user, uint256 _amount) internal /* returns (bool) */
	{
		m_accounts[_user].stake  = m_accounts[_user].stake.sub(_amount);
		m_accounts[_user].locked = m_accounts[_user].locked.add(_amount);
		/* return true; */
	}
	function unlock(address _user, uint256 _amount) internal /* returns (bool) */
	{
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		m_accounts[_user].stake  = m_accounts[_user].stake.add(_amount);
		/* return true; */
	}
}
