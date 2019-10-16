pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";
import "./IexecTokenSpender.sol";


interface IexecERC20
{
	event Transfer(address indexed from, address indexed to, uint256 value);
	event Approval(address indexed owner, address indexed spender, uint256 value);

	function transfer(address,uint256) external returns (bool);
	function approve(address,uint256) external returns (bool);
	function transferFrom(address,address,uint256) external returns (bool);
	function increaseAllowance(address,uint256) external returns (bool);
	function decreaseAllowance(address,uint256) external returns (bool);
	function approveAndCall(address,uint256,bytes calldata) external returns (bool);
}

contract IexecERC20Common is DelegateBase
{
	using SafeMathExtended for uint256;

	event Transfer(address indexed from, address indexed to, uint256 value);
	event Approval(address indexed owner, address indexed spender, uint256 value);

	function _transfer(address sender, address recipient, uint256 amount)
		internal
	{
			require(sender != address(0), "ERC20: transfer from the zero address");
			require(recipient != address(0), "ERC20: transfer to the zero address");

			m_balances[sender] = m_balances[sender].sub(amount);
			m_balances[recipient] = m_balances[recipient].add(amount);
			emit Transfer(sender, recipient, amount);
	}

	function _mint(address account, uint256 amount)
		internal
	{
			require(account != address(0), "ERC20: mint to the zero address");

			m_totalSupply = m_totalSupply.add(amount);
			m_balances[account] = m_balances[account].add(amount);
			emit Transfer(address(0), account, amount);
	}

	function _burn(address account, uint256 value)
		internal
	{
			require(account != address(0), "ERC20: burn from the zero address");

			m_totalSupply = m_totalSupply.sub(value);
			m_balances[account] = m_balances[account].sub(value);
			emit Transfer(account, address(0), value);
	}

	function _approve(address owner, address spender, uint256 value)
		internal
	{
			require(owner != address(0), "ERC20: approve from the zero address");
			require(spender != address(0), "ERC20: approve to the zero address");

			m_allowances[owner][spender] = value;
			emit Approval(owner, spender, value);
	}
}

contract IexecERC20Delegate is IexecERC20, DelegateBase, IexecERC20Common
{
	function transfer(address recipient, uint256 amount)
		public returns (bool)
	{
			_transfer(msg.sender, recipient, amount);
			return true;
	}

	function approve(address spender, uint256 value)
		public returns (bool)
	{
			_approve(msg.sender, spender, value);
			return true;
	}

	function approveAndCall(address spender, uint256 value, bytes memory extraData)
		public returns (bool)
	{
			_approve(msg.sender, spender, value);
			IexecTokenSpender(spender).receiveApproval(msg.sender, value, address(this), extraData);
			return true;
	}

	function transferFrom(address sender, address recipient, uint256 amount)
		public returns (bool)
	{
			_transfer(sender, recipient, amount);
			_approve(sender, msg.sender, m_allowances[sender][msg.sender].sub(amount));
			return true;
	}

	function increaseAllowance(address spender, uint256 addedValue)
		public returns (bool)
	{
			_approve(msg.sender, spender, m_allowances[msg.sender][spender].add(addedValue));
			return true;
	}


	function decreaseAllowance(address spender, uint256 subtractedValue)
		public returns (bool)
	{
			_approve(msg.sender, spender, m_allowances[msg.sender][spender].sub(subtractedValue));
			return true;
	}
}
