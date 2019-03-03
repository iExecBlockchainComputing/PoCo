pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;

import "./libs/IexecODBLibOrders.sol";

contract Relay
{
	event BroadcastAppOrder       (IexecODBLibOrders.AppOrder        apporder       );
	event BroadcastDatasetOrder   (IexecODBLibOrders.DatasetOrder    datasetorder   );
	event BroadcastWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder workerpoolorder);
	event BroadcastRequestOrder   (IexecODBLibOrders.RequestOrder    requestorder   );

	constructor() public {}

	function broadcastAppOrder       (IexecODBLibOrders.AppOrder        memory _apporder       ) public { emit BroadcastAppOrder       (_apporder       ); }
	function broadcastDatasetOrder   (IexecODBLibOrders.DatasetOrder    memory _datasetorder   ) public { emit BroadcastDatasetOrder   (_datasetorder   ); }
	function broadcastWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder memory _workerpoolorder) public { emit BroadcastWorkerpoolOrder(_workerpoolorder); }
	function broadcastRequestOrder   (IexecODBLibOrders.RequestOrder    memory _requestorder   ) public { emit BroadcastRequestOrder   (_requestorder   ); }
}
