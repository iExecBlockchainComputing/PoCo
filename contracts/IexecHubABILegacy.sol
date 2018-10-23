pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./tools/IexecODBLibCore.sol";
import "./tools/IexecODBLibOrders.sol";
import "./tools/EIP1154.sol";
import "./tools/SafeMathOZ.sol";

import "./CategoryManager.sol";

import "./IexecClerk.sol";
import "./registries/RegistryBase.sol";

contract IexecHubABILegacy
{
	uint256 public constant SCORE_UNITARY_SLASH      = 50;
	uint256 public constant CONSENSUS_DURATION_RATIO = 10;
	uint256 public constant REVEAL_DURATION_RATIO    = 2;

	IexecClerk   public iexecclerk;
	RegistryBase public dappregistry;
	RegistryBase public dataregistry;
	RegistryBase public poolregistry;

	mapping(address => uint256) public m_workerScores;
	mapping(address => address) public m_workerAffectations;

	event TaskInitialize(bytes32 indexed taskid, address indexed pool                     );
	event TaskContribute(bytes32 indexed taskid, address indexed worker, bytes32 hash     );
	event TaskConsensus (bytes32 indexed taskid,                         bytes32 consensus);
	event TaskReveal    (bytes32 indexed taskid, address indexed worker, bytes32 digest   );
	event TaskReopen    (bytes32 indexed taskid                                           );
	event TaskFinalize  (bytes32 indexed taskid,                         bytes   results  );
	event TaskClaimed   (bytes32 indexed taskid                                           );

	event AccurateContribution(address indexed worker, bytes32 indexed taskid);
	event FaultyContribution  (address indexed worker, bytes32 indexed taskid);

	event WorkerSubscription  (address indexed pool, address indexed worker);
	event WorkerUnsubscription(address indexed pool, address indexed worker);
	event WorkerEviction      (address indexed pool, address indexed worker);

	function attachContracts(
		address _iexecclerkAddress,
		address _dappRegistryAddress,
		address _dataRegistryAddress,
		address _poolRegistryAddress)
	public;

	function viewScore(address _worker)
	public view returns (uint256);

	function viewAffectation(address _worker)
	public view returns (Pool);

	function checkResources(address daap, address data, address pool)
	public view returns (bool);

	function resultFor(bytes32 id)
	external view returns (bytes result);

	function initialize(bytes32 _dealid, uint256 idx)
	public returns (bytes32);

	function consensus(
		bytes32 _taskid,
		bytes32 _consensus)
	public;

	function reveal(
		bytes32 _taskid,
		bytes32 _resultDigest)
	public;

	function reopen(
		bytes32 _taskid)
	public;

	function finalize(
		bytes32 _taskid,
		bytes  _results)
	public;

	function claim(
		bytes32 _taskid)
	public;

	function subscribe(Pool _pool)
	public returns (bool);

	function unsubscribe()
	public returns (bool);

	function evict(address _worker)
	public returns (bool);




	function viewTaskABILegacy(bytes32 _taskid)
	public view returns
	( IexecODBLibCore.TaskStatusEnum
	, bytes32
	, uint256
	, uint256
	, bytes32
	, uint256
	, uint256
	, uint256
	, address[]
	, bytes
	);

	function viewContributionABILegacy(bytes32 _taskid, address _worker)
	public view returns
	( IexecODBLibCore.ContributionStatusEnum
	, bytes32
	, bytes32
	, address
	, uint256
	, uint256
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
	public view returns (string, string, uint256);
}
