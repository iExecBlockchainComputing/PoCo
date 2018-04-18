pragma solidity ^0.4.21;

import './MarketplaceInterface.sol';

contract MarketplaceAccessor
{
	address              internal marketplaceAddress;
	MarketplaceInterface internal marketplaceInterface;
/* not used
	modifier onlyMarketplace()
	{
		require(msg.sender == marketplaceAddress);
		_;
	}*/

	function MarketplaceAccessor(address _marketplaceAddress) public
	{
		require(_marketplaceAddress != address(0));
		marketplaceAddress   = _marketplaceAddress;
		marketplaceInterface = MarketplaceInterface(_marketplaceAddress);
	}
}
