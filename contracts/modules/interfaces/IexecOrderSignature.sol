pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../libs/IexecODBLibOrders_v4.sol";


interface IexecOrderSignature
{
	event ClosedAppOrder       (bytes32 appHash);
	event ClosedDatasetOrder   (bytes32 datasetHash);
	event ClosedWorkerpoolOrder(bytes32 workerpoolHash);
	event ClosedRequestOrder   (bytes32 requestHash);

	function signAppOrder         (IexecODBLibOrders_v4.AppOrder        calldata) external returns (bool);
	function signDatasetOrder     (IexecODBLibOrders_v4.DatasetOrder    calldata) external returns (bool);
	function signWorkerpoolOrder  (IexecODBLibOrders_v4.WorkerpoolOrder calldata) external returns (bool);
	function signRequestOrder     (IexecODBLibOrders_v4.RequestOrder    calldata) external returns (bool);
	function cancelAppOrder       (IexecODBLibOrders_v4.AppOrder        calldata) external returns (bool);
	function cancelDatasetOrder   (IexecODBLibOrders_v4.DatasetOrder    calldata) external returns (bool);
	function cancelWorkerpoolOrder(IexecODBLibOrders_v4.WorkerpoolOrder calldata) external returns (bool);
	function cancelRequestOrder   (IexecODBLibOrders_v4.RequestOrder    calldata) external returns (bool);
}
