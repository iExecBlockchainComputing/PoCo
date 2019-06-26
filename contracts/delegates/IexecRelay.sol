pragma solidity ^0.5.9;
pragma experimental ABIEncoderV2;

import "../IexecStore.sol";


interface IexecRelay
{
	event BroadcastAppOrder       (IexecODBLibOrders.AppOrder        apporder       );
	event BroadcastDatasetOrder   (IexecODBLibOrders.DatasetOrder    datasetorder   );
	event BroadcastWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder workerpoolorder);
	event BroadcastRequestOrder   (IexecODBLibOrders.RequestOrder    requestorder   );

	function broadcastAppOrder       (IexecODBLibOrders.AppOrder        calldata _apporder       ) external;
	function broadcastDatasetOrder   (IexecODBLibOrders.DatasetOrder    calldata _datasetorder   ) external;
	function broadcastWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder calldata _workerpoolorder) external;
	function broadcastRequestOrder   (IexecODBLibOrders.RequestOrder    calldata _requestorder   ) external;
}

contract IexecRelayDelegate is IexecRelay, IexecStore
{
	function broadcastAppOrder       (IexecODBLibOrders.AppOrder        calldata _apporder       ) external { emit BroadcastAppOrder       (_apporder       ); }
	function broadcastDatasetOrder   (IexecODBLibOrders.DatasetOrder    calldata _datasetorder   ) external { emit BroadcastDatasetOrder   (_datasetorder   ); }
	function broadcastWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder calldata _workerpoolorder) external { emit BroadcastWorkerpoolOrder(_workerpoolorder); }
	function broadcastRequestOrder   (IexecODBLibOrders.RequestOrder    calldata _requestorder   ) external { emit BroadcastRequestOrder   (_requestorder   ); }
}
