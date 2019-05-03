pragma solidity ^0.5.8;
pragma experimental ABIEncoderV2;

import "./libs/IexecODBLibCore.sol";
import "./registries/RegistryBase.sol";
import "./IexecClerk.sol";


contract IexecHubABILegacy
{
	uint256 public constant CONSENSUS_DURATION_RATIO = 10;
	uint256 public constant REVEAL_DURATION_RATIO    = 2;

	IexecClerk   public iexecclerk;
	RegistryBase public appregistry;
	RegistryBase public datasetregistry;
	RegistryBase public workerpoolregistry;

	event TaskInitialize(bytes32 indexed taskid, address indexed workerpool               );
	event TaskContribute(bytes32 indexed taskid, address indexed worker, bytes32 hash     );
	event TaskConsensus (bytes32 indexed taskid,                         bytes32 consensus);
	event TaskReveal    (bytes32 indexed taskid, address indexed worker, bytes32 digest   );
	event TaskReopen    (bytes32 indexed taskid                                           );
	event TaskFinalize  (bytes32 indexed taskid,                         bytes   results  );
	event TaskClaimed   (bytes32 indexed taskid                                           );

	event AccurateContribution(address indexed worker, bytes32 indexed taskid);
	event FaultyContribution  (address indexed worker, bytes32 indexed taskid);

	function attachContracts(
		address _iexecclerkAddress,
		address _appregistryAddress,
		address _datasetregistryAddress,
		address _workerpoolregistryAddress)
	external;

	function viewScore(address _worker)
	external view returns (uint256);

	function checkResources(address aap, address dataset, address workerpool)
	external view returns (bool);

	function resultFor(bytes32 id)
	external view returns (bytes memory);

	function initialize(
		bytes32 _dealid,
		uint256 idx)
	public returns (bytes32);

	function contribute(
		bytes32      _taskid,
		bytes32      _resultHash,
		bytes32      _resultSeal,
		address      _enclaveChallenge,
		bytes memory _enclaveSign,
		bytes memory _workerpoolSign)
	public;

	function reveal(
		bytes32 _taskid,
		bytes32 _resultDigest)
	external;

	function reopen(
		bytes32 _taskid)
	external;

	function finalize(
		bytes32 _taskid,
		bytes calldata  _results)
	external;

	function claim(
		bytes32 _taskid)
	public;

	function initializeArray(
		bytes32[] calldata _dealid,
		uint256[] calldata _idx)
	external returns (bool);

	function claimArray(
		bytes32[] calldata _taskid)
	external returns (bool);

	function initializeAndClaimArray(
		bytes32[] calldata _dealid,
		uint256[] calldata _idx)
	external returns (bool);

	function viewTaskABILegacy(bytes32 _taskid)
	external view returns
	( IexecODBLibCore.TaskStatusEnum
	, bytes32
	, uint256
	, uint256
	, uint256
	, uint256
	, uint256
	, bytes32
	, uint256
	, uint256
	, address[] memory
	, bytes     memory
	);

	function viewContributionABILegacy(bytes32 _taskid, address _worker)
	external view returns
	( IexecODBLibCore.ContributionStatusEnum
	, bytes32
	, bytes32
	, address
	);

	function viewCategoryABILegacy(uint256 _catid)
	external view returns (string memory, string memory, uint256);
}
