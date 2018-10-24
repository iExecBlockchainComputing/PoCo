pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./tools/IexecODBLibOrders.sol";

contract Beacon
{
	event BroadcastDappOrder(IexecODBLibOrders.DappOrder dapporder);
	event BroadcastDataOrder(IexecODBLibOrders.DataOrder dataorder);
	event BroadcastPoolOrder(IexecODBLibOrders.PoolOrder poolorder);
	event BroadcastUserOrder(IexecODBLibOrders.UserOrder userorder);

	constructor() public {}

	function broadcastDappOrder(IexecODBLibOrders.DappOrder _dapporder) public { emit BroadcastDappOrder(_dapporder); }
	function broadcastDataOrder(IexecODBLibOrders.DataOrder _dataorder) public { emit BroadcastDataOrder(_dataorder); }
	function broadcastPoolOrder(IexecODBLibOrders.PoolOrder _poolorder) public { emit BroadcastPoolOrder(_poolorder); }
	function broadcastUserOrder(IexecODBLibOrders.UserOrder _userorder) public { emit BroadcastUserOrder(_userorder); }
}
