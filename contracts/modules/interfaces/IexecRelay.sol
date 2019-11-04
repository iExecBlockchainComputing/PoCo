pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../libs/IexecODBLibOrders.sol";


interface IexecRelay
{
	event BroadcastAppOrder       (IexecODBLibOrders.AppOrder        apporder       );
	event BroadcastDatasetOrder   (IexecODBLibOrders.DatasetOrder    datasetorder   );
	event BroadcastWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder workerpoolorder);
	event BroadcastRequestOrder   (IexecODBLibOrders.RequestOrder    requestorder   );

	function broadcastAppOrder       (IexecODBLibOrders.AppOrder        calldata) external;
	function broadcastDatasetOrder   (IexecODBLibOrders.DatasetOrder    calldata) external;
	function broadcastWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder calldata) external;
	function broadcastRequestOrder   (IexecODBLibOrders.RequestOrder    calldata) external;
}
