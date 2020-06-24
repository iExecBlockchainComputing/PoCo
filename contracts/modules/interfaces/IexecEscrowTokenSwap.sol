pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../../libs/IexecLibOrders_v5.sol";


interface IexecEscrowTokenSwap
{
	receive() external payable;
	fallback() external payable;

	function UniswapV2Router           ()        external view returns (IUniswapV2Router02);
	function estimateDepositEthSent    (uint256) external view returns (uint256);
	function estimateDepositTokenWanted(uint256) external view returns (uint256);
	function estimateWithdrawTokenSent (uint256) external view returns (uint256);
	function estimateWithdrawEthWanted (uint256) external view returns (uint256);
	
	function depositEth       (                         ) external payable;
	function depositEthFor    (                  address) external payable;
	function safeDepositEth   (         uint256         ) external payable;
	function safeDepositEthFor(         uint256, address) external payable;
	function requestToken     (uint256                  ) external payable;
	function requestTokenFor  (uint256,          address) external payable;
	function withdrawEth      (uint256                  ) external;
	function withdrawEthTo    (uint256,          address) external;
	function safeWithdrawEth  (uint256, uint256         ) external;
	function safeWithdrawEthTo(uint256, uint256, address) external;

	function matchOrdersWithEth(
		IexecLibOrders_v5.AppOrder        memory,
		IexecLibOrders_v5.DatasetOrder    memory,
		IexecLibOrders_v5.WorkerpoolOrder memory,
		IexecLibOrders_v5.RequestOrder    memory)
	external payable returns (bytes32);
}
