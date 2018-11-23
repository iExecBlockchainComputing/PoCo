pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import "./libs/IexecODBLibOrders.sol";

contract Relay
{
	event BroadcastAppOrder       (IexecODBLibOrders.AppOrder        apporder       );
	event BroadcastDatasetOrder   (IexecODBLibOrders.DatasetOrder    datasetorder   );
	event BroadcastWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder workerpoolorder);
	event BroadcastRequestOrder   (IexecODBLibOrders.RequestOrder    requestorder   );

	constructor() public {}

	function broadcastAppOrder       (IexecODBLibOrders.AppOrder        _apporder       ) public { emit BroadcastAppOrder       (_apporder       ); }
	function broadcastDatasetOrder   (IexecODBLibOrders.DatasetOrder    _datasetorder   ) public { emit BroadcastDatasetOrder   (_datasetorder   ); }
	function broadcastWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder _workerpoolorder) public { emit BroadcastWorkerpoolOrder(_workerpoolorder); }
	function broadcastRequestOrder   (IexecODBLibOrders.RequestOrder    _requestorder   ) public { emit BroadcastRequestOrder   (_requestorder   ); }
}
