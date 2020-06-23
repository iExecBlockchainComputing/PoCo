pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./IexecERC20Common.sol";
import "./SignatureVerifier.sol";
import "../DelegateBase.sol";
import "../interfaces/IexecEscrowTokenSwap.sol";
import "../interfaces/IexecPoco.sol";


contract IexecEscrowTokenSwapDelegate is IexecEscrowTokenSwap, DelegateBase, IexecERC20Common, SignatureVerifier
{
	using SafeMathExtended  for uint256;
	using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
	using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
	using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
	using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;

	IUniswapV2Router02 internal constant router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

	/***************************************************************************
	 *                                Accessor                                 *
	 ***************************************************************************/
	function UniswapV2Router()
	external view override returns (IUniswapV2Router02)
	{
		return router;
	}

	/***************************************************************************
	 *                        Swapping methods - Public                        *
	 ***************************************************************************/
	receive()
	external override payable
	{
		_deposit(_msgSender(), msg.value, 0);
	}

	function depositEth()
	external override payable
	{
		_deposit(_msgSender(), msg.value, 0);
	}

	function safeDepositEth(uint256 minimum)
	external override payable
	{
		_deposit(_msgSender(), msg.value, minimum);
	}

	function depositEthFor(address target)
	external override payable
	{
		_deposit(target, msg.value, 0);
	}

	function safeDepositEthFor(uint256 minimum, address target)
	external override payable
	{
		_deposit(target, msg.value, minimum);
	}

	function withdrawEth(uint256 amount)
	external override
	{
		_withdraw(_msgSender(), amount, 0);
	}

	function safeWithdrawEth(uint256 amount, uint256 minimum)
	external override
	{
		_withdraw(_msgSender(), amount, minimum);
	}

	function estimateDepositEthSent(uint256 eth)
	external view override returns (uint256 token)
	{
		return router.getAmountsOut(eth, _eth2token())[1];
	}

	function estimateDepositTokenWanted(uint256 token)
	external view override returns (uint256 eth)
	{
		return router.getAmountsIn(token, _eth2token())[0];
	}

	function estimateWithdrawTokenSent(uint256 token)
	external view override returns (uint256 eth)
	{
		return router.getAmountsOut(token, _token2eth())[1];
	}

	function estimateWithdrawEthWanted(uint256 eth)
	external view override returns (uint256 token)
	{
		return router.getAmountsIn(eth, _token2eth())[0];
	}

	/***************************************************************************
	 *                       Swapping methods - Internal                       *
	 ***************************************************************************/
	function _deposit(address user, uint256 value, uint256 minimum)
	internal
	{
		uint256[] memory amounts = router.swapExactETHForTokens{value: value}(minimum, _eth2token(), address(this), now+1);
		_mint(user, amounts[1]);
	}

	function _depositExact(address user, uint256 value, uint256 exact)
	internal
	{
		uint256[] memory amounts = router.swapETHForExactTokens{value: value}(exact, _eth2token(), address(this), now+1);
		_mint(user, amounts[1]);
		// Refund remaining ETH
		(bool success, ) = user.call{value: value.sub(amounts[0])}('');
		require(success, 'native-transfer-failed');
	}

	function _withdraw(address user, uint256 amount, uint256 minimum)
	internal
	{
		m_baseToken.approve(address(router), amount);
		uint256[] memory amounts = router.swapExactTokensForETH(amount, minimum, _token2eth(), user, now+1);
		_burn(user, amounts[0]);
	}

	function _eth2token()
	internal view returns (address[] memory)
	{
		address[] memory path = new address[](2);
		path[0] = router.WETH();
		path[1] = address(m_baseToken);
		return path;
	}

	function _token2eth()
	internal view returns (address[] memory)
	{
		address[] memory path = new address[](2);
		path[0] = address(m_baseToken);
		path[1] = router.WETH();
		return path;
	}

	/***************************************************************************
	 *                          Extra public methods                           *
	 ***************************************************************************/
	function matchOrdersWithEth(
		IexecLibOrders_v5.AppOrder        memory _apporder,
		IexecLibOrders_v5.DatasetOrder    memory _datasetorder,
		IexecLibOrders_v5.WorkerpoolOrder memory _workerpoolorder,
		IexecLibOrders_v5.RequestOrder    memory _requestorder)
	public payable override returns (bytes32)
	{
		uint256 volume;
		volume =                   _apporder.volume.sub(m_consumed[keccak256(_toEthTypedStruct(       _apporder.hash(), EIP712DOMAIN_SEPARATOR))]);
		if (_datasetorder.dataset != address(0))
		volume = volume.min(   _datasetorder.volume.sub(m_consumed[keccak256(_toEthTypedStruct(   _datasetorder.hash(), EIP712DOMAIN_SEPARATOR))]));
		volume = volume.min(_workerpoolorder.volume.sub(m_consumed[keccak256(_toEthTypedStruct(_workerpoolorder.hash(), EIP712DOMAIN_SEPARATOR))]));
		volume = volume.min(   _requestorder.volume.sub(m_consumed[keccak256(_toEthTypedStruct(   _requestorder.hash(), EIP712DOMAIN_SEPARATOR))]));

		_depositExact(
			_requestorder.requester,
			msg.value,
			_apporder.appprice
			.add(_datasetorder.dataset != address(0) ? _datasetorder.datasetprice : 0)
			.add(_workerpoolorder.workerpoolprice)
			.mul(volume)
		);

		return IexecPoco(address(this)).matchOrders(_apporder, _datasetorder, _workerpoolorder, _requestorder);
	}
}
