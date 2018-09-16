pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./IexecODBLib.sol";

contract Beacon
{
	event BroadcastDappOrder(IexecODBLib.DappOrder);
	event BroadcastDataOrder(IexecODBLib.DataOrder);
	event BroadcastPoolOrder(IexecODBLib.PoolOrder);
	event BroadcastUserOrder(IexecODBLib.UserOrder);

	constructor() public {}

	function broadcastDappOrder(IexecODBLib.DappOrder _dapporder) public { emit BroadcastDappOrder(_dapporder); }
	function broadcastDataOrder(IexecODBLib.DataOrder _dataorder) public { emit BroadcastDataOrder(_dataorder); }
	function broadcastPoolOrder(IexecODBLib.PoolOrder _poolorder) public { emit BroadcastPoolOrder(_poolorder); }
	function broadcastUserOrder(IexecODBLib.UserOrder _userorder) public { emit BroadcastUserOrder(_userorder); }
}
