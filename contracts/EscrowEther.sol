pragma solidity ^0.5.8;
pragma experimental ABIEncoderV2;

import "iexec-solidity/contracts/ERC20_Token/IERC20.sol";
import "iexec-solidity/contracts/ERC20_Token/ERC20.sol";
import "iexec-solidity/contracts/ERC20_Token/ERC20Detailed.sol";
import "iexec-solidity/contracts/Libs/SafeMath.sol";

import "./libs/IexecODBLibCore.sol";


contract EscrowERC20 is ERC20, ERC20Detailed
{
	using SafeMath for uint256;

	/**
	 * Escrow content
	 */
	mapping (address => uint256) private _frozens;

	/**
	 * Events
	 */
	event Withdraw  (address owner, uint256 amount);
	event Reward    (address user,  uint256 amount, bytes32 ref);
	event Seize     (address user,  uint256 amount, bytes32 ref);
	event Lock      (address user,  uint256 amount);
	event Unlock    (address user,  uint256 amount);

	/**
	 * Constructor
	 */
	constructor()
		public
		ERC20Detailed("stakeEther", "sETH", 18)
	{
	}

	/**
	 * Accessor
	 */

	function frozenOf(address owner)
		public view returns (uint256)
	{
		return _frozens[owner];
	}

	function viewAccount(address owner)
		public view returns (IexecODBLibCore.Account memory account)
	{
		return IexecODBLibCore.Account(balanceOf(owner), frozenOf(owner));
	}

	function token()
		external view returns (address)
	{
		return address(0);
	}

	/**
	 * Wallet methods: public
	 */
	function ()
		external payable
	{
		_mint(msg.sender, msg.value);
	}

	function deposit()
		external payable returns (bool)
	{
		_mint(msg.sender, msg.value);
		return true;
	}

	function depositFor(address target)
		external payable returns (bool)
	{
		_mint(target, msg.value);
		return true;
	}

	function depositForArray(uint256[] calldata amounts, address[] calldata targets)
		external payable returns (bool)
	{
		require(amounts.length == targets.length);
		uint256 remaining = msg.value;
		for (uint i = 0; i < amounts.length; ++i)
		{
			remaining = remaining.sub(amounts[i]);
			_mint(targets[i], amounts[i]);
		}
		_mint(msg.sender, remaining);
		return true;
	}

	function withdraw(uint256 amount)
		external returns (bool)
	{
		_burn(msg.sender, amount);
		msg.sender.transfer(amount);
		return true;
	}

	/**
	 * Wallet methods: Internal
	 */
	function reward(address user, uint256 amount, bytes32 ref)
		internal /* returns (bool) */
	{
		_transfer(address(this), user, amount);
		emit Reward(user, amount, ref);
		/* return true; */
	}

	function seize(address user, uint256 amount, bytes32 ref)
		internal /* returns (bool) */
	{
		_frozens[user] = _frozens[user].sub(amount);
		emit Seize(user, amount, ref);
		/* return true; */
	}

	function lock(address user, uint256 amount)
		internal /* returns (bool) */
	{
		_transfer(user, address(this), amount);
		_frozens[user] = _frozens[user].add(amount);
		emit Lock(user, amount);
		/* return true; */
	}

	function unlock(address user, uint256 amount)
		internal /* returns (bool) */
	{
		_transfer(address(this), user, amount);
		_frozens[user] = _frozens[user].sub(amount);
		emit Unlock(user, amount);
		/* return true; */
	}
}
