pragma solidity ^0.5.7;
pragma experimental ABIEncoderV2;

contract IexecClerkABILegacy
{
	uint256 public constant POOL_STAKE_RATIO = 30;
	uint256 public constant KITTY_RATIO      = 10;
	uint256 public constant KITTY_MIN        = 1000000000; // TODO: 1RLC ?

	bytes32 public /* immutable */ EIP712DOMAIN_SEPARATOR;

	mapping(bytes32 => bytes32[]) public m_requestdeals;
	mapping(bytes32 => uint256  ) public m_consumed;
	mapping(bytes32 => bool     ) public m_presigned;

	event OrdersMatched        (bytes32 dealid, bytes32 appHash, bytes32 datasetHash, bytes32 workerpoolHash, bytes32 requestHash, uint256 volume);
	event ClosedAppOrder       (bytes32 appHash);
	event ClosedDatasetOrder   (bytes32 datasetHash);
	event ClosedWorkerpoolOrder(bytes32 workerpoolHash);
	event ClosedRequestOrder   (bytes32 requestHash);
	event SchedulerNotice      (address indexed workerpool, bytes32 dealid);

	function viewRequestDeals(bytes32 _id)
	external view returns (bytes32[] memory);

	function viewConsumed(bytes32 _id)
	external view returns (uint256);

	function lockContribution(bytes32 _dealid, address _worker)
	external;

	function unlockContribution(bytes32 _dealid, address _worker)
	external;

	function unlockAndRewardForContribution(bytes32 _dealid, address _worker, uint256 _amount, bytes32 _taskid)
	external;

	function seizeContribution(bytes32 _dealid, address _worker, bytes32 _taskid)
	external;

	function rewardForScheduling(bytes32 _dealid, uint256 _amount, bytes32 _taskid)
	external;

	function successWork(bytes32 _dealid, bytes32 _taskid)
	external;

	function failedWork(bytes32 _dealid, bytes32 _taskid)
	external;




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
