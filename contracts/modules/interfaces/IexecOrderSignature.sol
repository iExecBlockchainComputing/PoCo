pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../libs/IexecODBLibOrders.sol";


interface IexecOrderSignature
{
	event ClosedAppOrder       (bytes32 appHash);
	event ClosedDatasetOrder   (bytes32 datasetHash);
	event ClosedWorkerpoolOrder(bytes32 workerpoolHash);
	event ClosedRequestOrder   (bytes32 requestHash);

	function signAppOrder         (IexecODBLibOrders.AppOrder        calldata) external returns (bool);
	function signDatasetOrder     (IexecODBLibOrders.DatasetOrder    calldata) external returns (bool);
	function signWorkerpoolOrder  (IexecODBLibOrders.WorkerpoolOrder calldata) external returns (bool);
	function signRequestOrder     (IexecODBLibOrders.RequestOrder    calldata) external returns (bool);
	function cancelAppOrder       (IexecODBLibOrders.AppOrder        calldata) external returns (bool);
	function cancelDatasetOrder   (IexecODBLibOrders.DatasetOrder    calldata) external returns (bool);
	function cancelWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder calldata) external returns (bool);
	function cancelRequestOrder   (IexecODBLibOrders.RequestOrder    calldata) external returns (bool);
}
