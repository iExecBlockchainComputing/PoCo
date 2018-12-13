pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./interfaces/EIP1154.sol";
import "./libs/IexecODBLibCore.sol";
import "./libs/IexecODBLibOrders.sol";
import "./libs/SafeMathOZ.sol";
import "./registries/RegistryBase.sol";

import "./CategoryManager.sol";
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
	public;

	function viewScore(address _worker)
	public view returns (uint256);

	function checkResources(address aap, address dataset, address workerpool)
	external view returns (bool);

	function resultFor(bytes32 id)
	external view returns (bytes memory);

	function initialize(bytes32 _dealid, uint256 idx)
	public returns (bytes32);

	function reveal(
		bytes32 _taskid,
		bytes32 _resultDigest)
	public;

	function reopen(
		bytes32 _taskid)
	public;

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

	function viewTaskABILegacy(bytes32 _taskid)
	public view returns
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
	public view returns
	( IexecODBLibCore.ContributionStatusEnum
	, bytes32
	, bytes32
	, address
	);

	function contributeABILegacy(
		bytes32 _taskid,
		bytes32 _resultHash,
		bytes32 _resultSeal,
		address _enclaveChallenge,
		uint8   _enclaveSign_v,
		bytes32 _enclaveSign_r,
		bytes32 _enclaveSign_s,
		uint8   _poolSign_v,
		bytes32 _poolSign_r,
		bytes32 _poolSign_s)
	public;

	function viewCategoryABILegacy(uint256 _catid)
	public view returns (string memory, string memory, uint256);
}
