pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/IexecRelay.sol";


contract IexecRelayDelegate is IexecRelay, DelegateBase
{
	function broadcastAppOrder       (IexecODBLibOrders_v4.AppOrder        calldata _apporder       ) external { emit BroadcastAppOrder       (_apporder       ); }
	function broadcastDatasetOrder   (IexecODBLibOrders_v4.DatasetOrder    calldata _datasetorder   ) external { emit BroadcastDatasetOrder   (_datasetorder   ); }
	function broadcastWorkerpoolOrder(IexecODBLibOrders_v4.WorkerpoolOrder calldata _workerpoolorder) external { emit BroadcastWorkerpoolOrder(_workerpoolorder); }
	function broadcastRequestOrder   (IexecODBLibOrders_v4.RequestOrder    calldata _requestorder   ) external { emit BroadcastRequestOrder   (_requestorder   ); }
}
