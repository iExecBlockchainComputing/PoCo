pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../libs/IexecODBLibOrders_v4.sol";


interface IexecOrderSignature
{
	event ClosedAppOrder       (bytes32 appHash);
	event ClosedDatasetOrder   (bytes32 datasetHash);
	event ClosedWorkerpoolOrder(bytes32 workerpoolHash);
	event ClosedRequestOrder   (bytes32 requestHash);

	function manageAppOrder       (IexecODBLibOrders_v4.AppOrderOperation        calldata) external returns (bool);
	function manageDatasetOrder   (IexecODBLibOrders_v4.DatasetOrderOperation    calldata) external returns (bool);
	function manageWorkerpoolOrder(IexecODBLibOrders_v4.WorkerpoolOrderOperation calldata) external returns (bool);
	function manageRequestOrder   (IexecODBLibOrders_v4.RequestOrderOperation    calldata) external returns (bool);
}
