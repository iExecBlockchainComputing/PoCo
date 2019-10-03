pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";
import "./IexecERC20.sol";


interface IexecEscrowNative
{
	function () external payable;
	function deposit() external payable returns (bool);
	function depositFor(address) external payable returns (bool);
	function depositForArray(uint256[] calldata,address[] calldata) external payable returns (bool);
	function withdraw(uint256) external returns (bool);
	function recover() external returns (uint256);
}

contract IexecEscrowNativeDelegate is IexecEscrowNative, DelegateBase, IexecERC20Common
{
	using SafeMathExtended for uint256;

	uint256 internal constant nRLCtoWei = 10 ** 9;
	/***************************************************************************
	 *                         Escrow methods: public                          *
	 ***************************************************************************/
	function ()
		external payable
	{
		_handleDeposit(msg.sender);
	}

	function deposit()
		external payable returns (bool)
	{
		_handleDeposit(msg.sender);
		return true;
	}

	function depositFor(address target)
		external payable returns (bool)
	{
		_handleDeposit(target);
		return true;
	}

	function depositForArray(uint256[] calldata amounts, address[] calldata targets)
		external payable returns (bool)
	{
		require(amounts.length == targets.length);
		uint256 remaining = msg.value;
		for (uint i = 0; i < amounts.length; ++i)
		{
			_mint(targets[i], amounts[i]);
			remaining = remaining.sub(amounts[i].mul(nRLCtoWei));
		}
		_safeWithdraw(msg.sender, remaining);
		return true;
	}

	function withdraw(uint256 amount)
		external returns (bool)
	{
		_burn(msg.sender, amount);
		_safeWithdraw(msg.sender, amount.mul(nRLCtoWei));
		return true;
	}

	function recover()
		external onlyOwner returns (uint256)
	{
		uint256 delta = address(this).balance.div(nRLCtoWei).sub(m_totalSupply);
		_mint(owner(), delta);
		return delta;
	}

	function _handleDeposit(address target)
		internal
	{
		_mint(target, msg.value.div(nRLCtoWei));
		_safeWithdraw(msg.sender, msg.value.mod(nRLCtoWei));
	}

	function _safeWithdraw(address payable to, uint256 value)
		internal
	{
		(bool success, ) = to.call.value(value)('');
		require(success, 'native-transfer-failled');
	}
}
