pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "./IexecERC20.sol";
import "../IexecDelegateBase.sol";


interface IexecEscrowToken
{
	function deposit(uint256) external returns (bool);
	function depositFor(uint256,address) external returns (bool);
	function depositForArray(uint256[] calldata,address[] calldata) external returns (bool);
	function withdraw(uint256) external returns (bool);
}

contract IexecEscrowTokenDelegate is IexecEscrowToken, IexecDelegateBase, IexecERC20Common
{
	/***************************************************************************
	 *                         Escrow methods: public                          *
	 ***************************************************************************/
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

	function _deposit(address from, uint256 amount)
		internal
	{
		require(m_baseToken.transferFrom(from, address(this), amount));
	}

	function _withdraw(address to, uint256 amount)
		internal
	{
		m_baseToken.transfer(to, amount);
	}
}
