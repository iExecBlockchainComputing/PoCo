pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../../libs/IexecLibOrders_v4.sol";


interface IexecRelay
{
	event BroadcastAppOrder       (IexecLibOrders_v4.AppOrder        apporder       );
	event BroadcastDatasetOrder   (IexecLibOrders_v4.DatasetOrder    datasetorder   );
	event BroadcastWorkerpoolOrder(IexecLibOrders_v4.WorkerpoolOrder workerpoolorder);
	event BroadcastRequestOrder   (IexecLibOrders_v4.RequestOrder    requestorder   );

	function broadcastAppOrder       (IexecLibOrders_v4.AppOrder        calldata) external;
	function broadcastDatasetOrder   (IexecLibOrders_v4.DatasetOrder    calldata) external;
	function broadcastWorkerpoolOrder(IexecLibOrders_v4.WorkerpoolOrder calldata) external;
	function broadcastRequestOrder   (IexecLibOrders_v4.RequestOrder    calldata) external;
}
