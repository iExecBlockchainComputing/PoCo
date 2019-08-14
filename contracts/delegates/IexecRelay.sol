pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";


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

contract IexecRelayDelegate is IexecRelay, DelegateBase
{
	function broadcastAppOrder       (IexecODBLibOrders.AppOrder        calldata _apporder       ) external { emit BroadcastAppOrder       (_apporder       ); }
	function broadcastDatasetOrder   (IexecODBLibOrders.DatasetOrder    calldata _datasetorder   ) external { emit BroadcastDatasetOrder   (_datasetorder   ); }
	function broadcastWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder calldata _workerpoolorder) external { emit BroadcastWorkerpoolOrder(_workerpoolorder); }
	function broadcastRequestOrder   (IexecODBLibOrders.RequestOrder    calldata _requestorder   ) external { emit BroadcastRequestOrder   (_requestorder   ); }
}
