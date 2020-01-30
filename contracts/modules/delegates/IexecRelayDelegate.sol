pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/IexecRelay.sol";


contract IexecRelayDelegate is IexecRelay, DelegateBase
{
	function broadcastAppOrder       (IexecLibOrders_v4.AppOrder        calldata _apporder       ) external { emit BroadcastAppOrder       (_apporder       ); }
	function broadcastDatasetOrder   (IexecLibOrders_v4.DatasetOrder    calldata _datasetorder   ) external { emit BroadcastDatasetOrder   (_datasetorder   ); }
	function broadcastWorkerpoolOrder(IexecLibOrders_v4.WorkerpoolOrder calldata _workerpoolorder) external { emit BroadcastWorkerpoolOrder(_workerpoolorder); }
	function broadcastRequestOrder   (IexecLibOrders_v4.RequestOrder    calldata _requestorder   ) external { emit BroadcastRequestOrder   (_requestorder   ); }
}
