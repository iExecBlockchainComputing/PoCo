pragma solidity ^0.5.8;
pragma experimental ABIEncoderV2;

import "../libs/IexecODBLibCore.sol";
import "../libs/IexecODBLibOrders.sol";


interface IexecClerkV3
{
	function WORKERPOOL_STAKE_RATIO() external view returns (uint256);
	function KITTY_RATIO           () external view returns (uint256);
	function KITTY_MIN             () external view returns (uint256);
	function GROUPMEMBER_PURPOSE   () external view returns (uint256);
	function EIP712DOMAIN_SEPARATOR() external view returns (bytes32);

	function viewRequestDeals(bytes32 _id) external view returns (bytes32[] memory requestdeals);
	function viewDeal        (bytes32 _id) external view returns (IexecODBLibCore.Deal memory deal);
	function viewConsumed    (bytes32 _id) external view returns (uint256 consumed);
	function viewPresigned   (bytes32 _id) external view returns (bool presigned);

	function signAppOrder       (IexecODBLibOrders.AppOrder        calldata _apporder       ) external returns (bool);
	function signDatasetOrder   (IexecODBLibOrders.DatasetOrder    calldata _datasetorder   ) external returns (bool);
	function signWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder calldata _workerpoolorder) external returns (bool);
	function signRequestOrder   (IexecODBLibOrders.RequestOrder    calldata _requestorder   ) external returns (bool);

	function matchOrders(
		IexecODBLibOrders.AppOrder        calldata _apporder,
		IexecODBLibOrders.DatasetOrder    calldata _datasetorder,
		IexecODBLibOrders.WorkerpoolOrder calldata _workerpoolorder,
		IexecODBLibOrders.RequestOrder    calldata _requestorder)
	external returns (bytes32);

	function cancelAppOrder       (IexecODBLibOrders.AppOrder        calldata _apporder       ) external returns (bool);
	function cancelDatasetOrder   (IexecODBLibOrders.DatasetOrder    calldata _datasetorder   ) external returns (bool);
	function cancelWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder calldata _workerpoolorder) external returns (bool);
	function cancelRequestOrder   (IexecODBLibOrders.RequestOrder    calldata _requestorder   ) external returns (bool);

	function viewDealABILegacy_pt1(bytes32 _id)
	external view returns
	( address
	, address
	, uint256
	, address
	, address
	, uint256
	, address
	, address
	, uint256
	);

	function viewDealABILegacy_pt2(bytes32 _id)
	external view returns
	( uint256
	, bytes32
	, address
	, address
	, address
	, string memory
	);

	function viewConfigABILegacy(bytes32 _id)
	external view returns
	( uint256
	, uint256
	, uint256
	, uint256
	, uint256
	, uint256
	);

	function viewAccountABILegacy(address _user)
	external view returns (uint256, uint256);
}
