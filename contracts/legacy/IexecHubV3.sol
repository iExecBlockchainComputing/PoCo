pragma solidity ^0.5.8;
pragma experimental ABIEncoderV2;

import "./IexecClerkV3.sol";
import "../libs/IexecODBLibCore.sol";


interface IexecHubV3
{
	function CONSENSUS_DURATION_RATIO() external view returns (uint256);
	function REVEAL_DURATION_RATIO   () external view returns (uint256);
	function iexecclerk              () external view returns (IexecClerkV3);
	function appregistry             () external view returns (address);
	function datasetregistry         () external view returns (address);
	function workerpoolregistry      () external view returns (address);

	function attachContracts(
		address _iexecclerkAddress,
		address _appregistryAddress,
		address _datasetregistryAddress,
		address _workerpoolregistryAddress)
	external;

	function viewTask(
		bytes32 _taskid)
	external view returns (IexecODBLibCore.Task memory);

	function viewContribution(
		bytes32 _taskid,
		address _worker)
	external view returns (IexecODBLibCore.Contribution memory);

	function viewScore(
		address _worker)
	external view returns (uint256);

	function checkResources(
		address app,
		address dataset,
		address workerpool)
	external view returns (bool);

	function resultFor(
		bytes32 id)
	external view returns (bytes memory);

	function initialize(
		bytes32 _dealid,
		uint256 idx)
	external returns (bytes32);

	function contribute(
		bytes32        _taskid,
		bytes32        _resultHash,
		bytes32        _resultSeal,
		address        _enclaveChallenge,
		bytes calldata _enclaveSign,
		bytes calldata _workerpoolSign)
	external;

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
	external;

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
