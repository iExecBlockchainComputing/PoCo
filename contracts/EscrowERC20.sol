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
	* token contract for transfers.
	*/
	IERC20 private _baseToken;

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
	constructor(address _token)
		public
		ERC20Detailed("stakeRLC", "sRLC", 9)
	{
		_baseToken = IERC20(_token);
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
		return address(_baseToken);
	}
	/**
	 * Wallet methods: public
	 */
	function deposit(uint256 amount)
		external returns (bool)
	{
		_deposit(msg.sender, amount);
		_mint(msg.sender, amount);
		return true;
	}

	function depositFor(uint256 amount, address target)
		external returns (bool)
	{
		_deposit(msg.sender, amount);
		_mint(target, amount);
		return true;
	}

	function depositForArray(uint256[] calldata amounts, address[] calldata targets)
		external returns (bool)
	{
		require(amounts.length == targets.length);
		for (uint i = 0; i < amounts.length; ++i)
		{
			_deposit(msg.sender, amounts[i]);
			_mint(targets[i], amounts[i]);
		}
		return true;
	}

	function withdraw(uint256 amount)
		external returns (bool)
	{
		_burn(msg.sender, amount);
		_withdraw(msg.sender, amount);
		return true;
	}

	// internal methods
	function _deposit(address from, uint256 amount)
		internal
	{
		require(_baseToken.transferFrom(from, address(this), amount));
	}

	function _withdraw(address to, uint256 amount)
		internal
	{
		_baseToken.transfer(to, amount);
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
