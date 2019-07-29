pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";
import "./IexecERC20.sol";


interface IexecEscrowToken
{
	function () external payable;
	function deposit(uint256) external returns (bool);
	function depositFor(uint256,address) external returns (bool);
	function depositForArray(uint256[] calldata,address[] calldata) external returns (bool);
	function withdraw(uint256) external returns (bool);
	function recover() external returns (uint256);
	function receiveApproval(address,uint256,address,bytes calldata) external returns (bool);
}

contract IexecEscrowTokenDelegate is IexecEscrowToken, DelegateBase, IexecERC20Common
{
	using SafeMathExtended for uint256;

	/***************************************************************************
	 *                         Escrow methods: public                          *
	 ***************************************************************************/
	function ()
		external payable
	{
		revert("fallback-disabled");
	}

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

	function recover()
		external onlyOwner returns (uint256)
	{
		uint256 delta = m_baseToken.balanceOf(address(this)).sub(m_totalSupply);
		_mint(owner(), delta);
		return delta;
	}

	// Token Spender (endpoint for approveAndCallback calls to the proxy)
	function receiveApproval(address sender, uint256 amount, address token, bytes calldata)
		external returns (bool)
	{
		require(token == address(m_baseToken), 'wrong-token');
		_deposit(sender, amount);
		_mint(sender, amount);
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
