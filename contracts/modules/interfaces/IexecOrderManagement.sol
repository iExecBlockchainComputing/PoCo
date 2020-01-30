pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../../libs/IexecLibOrders_v4.sol";


interface IexecOrderManagement
{
	event SignedAppOrder       (bytes32 appHash);
	event SignedDatasetOrder   (bytes32 datasetHash);
	event SignedWorkerpoolOrder(bytes32 workerpoolHash);
	event SignedRequestOrder   (bytes32 requestHash);
	event ClosedAppOrder       (bytes32 appHash);
	event ClosedDatasetOrder   (bytes32 datasetHash);
	event ClosedWorkerpoolOrder(bytes32 workerpoolHash);
	event ClosedRequestOrder   (bytes32 requestHash);

	function manageAppOrder       (IexecLibOrders_v4.AppOrderOperation        calldata) external;
	function manageDatasetOrder   (IexecLibOrders_v4.DatasetOrderOperation    calldata) external;
	function manageWorkerpoolOrder(IexecLibOrders_v4.WorkerpoolOrderOperation calldata) external;
	function manageRequestOrder   (IexecLibOrders_v4.RequestOrderOperation    calldata) external;
}
