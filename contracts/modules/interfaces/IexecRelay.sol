pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../libs/IexecODBLibOrders_v4.sol";


interface IexecRelay
{
	event BroadcastAppOrder       (IexecODBLibOrders_v4.AppOrder        apporder       );
	event BroadcastDatasetOrder   (IexecODBLibOrders_v4.DatasetOrder    datasetorder   );
	event BroadcastWorkerpoolOrder(IexecODBLibOrders_v4.WorkerpoolOrder workerpoolorder);
	event BroadcastRequestOrder   (IexecODBLibOrders_v4.RequestOrder    requestorder   );

	function broadcastAppOrder       (IexecODBLibOrders_v4.AppOrder        calldata) external;
	function broadcastDatasetOrder   (IexecODBLibOrders_v4.DatasetOrder    calldata) external;
	function broadcastWorkerpoolOrder(IexecODBLibOrders_v4.WorkerpoolOrder calldata) external;
	function broadcastRequestOrder   (IexecODBLibOrders_v4.RequestOrder    calldata) external;
}
