pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./Iexec0xLib.sol";

contract Beacon
{
	event BroadcastDappOrder(Iexec0xLib.DappOrder);
	event BroadcastDataOrder(Iexec0xLib.DataOrder);
	event BroadcastPoolOrder(Iexec0xLib.PoolOrder);
	event BroadcastUserOrder(Iexec0xLib.UserOrder);

	constructor() public {}

	function broadcastDappOrder(Iexec0xLib.DappOrder _dapporder) public { emit BroadcastDappOrder(_dapporder); }
	function broadcastDataOrder(Iexec0xLib.DataOrder _dataorder) public { emit BroadcastDataOrder(_dataorder); }
	function broadcastPoolOrder(Iexec0xLib.PoolOrder _poolorder) public { emit BroadcastPoolOrder(_poolorder); }
	function broadcastUserOrder(Iexec0xLib.UserOrder _userorder) public { emit BroadcastUserOrder(_userorder); }
}
