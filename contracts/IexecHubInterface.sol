pragma solidity ^0.4.21;

import "rlc-token/contracts/RLC.sol";

contract IexecHubInterface
{
	RLC public rlc;

	function attachContracts(
		address _tokenAddress,
		address _marketplaceAddress,
		address _workerPoolHubAddress,
		address _appHubAddress,
		address _datasetHubAddress)
		public;

	function setCategoriesCreator(
		address _categoriesCreator)
	public;

	function createCategory(
		string  _name,
		string  _description,
		uint256 _workClockTimeRef)
	public returns (uint256 catid);

	function createWorkerPool(
		string  _description,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy)
	external returns (address createdWorkerPool);

	function createApp(
		string  _appName,
		uint256 _appPrice,
		string  _appParams)
	external returns (address createdApp);

	function createDataset(
		string  _datasetName,
		uint256 _datasetPrice,
		string  _datasetParams)
	external returns (address createdDataset);

	function buyForWorkOrder(
		uint256 _marketorderIdx,
		address _workerpool,
		address _app,
		address _dataset,
		string  _params,
		address _callback,
		address _beneficiary)
	external returns (address);

	function isWoidRegistred(
		address _woid)
	public view returns (bool);

	function lockWorkOrderCost(
		address _requester,
		address _workerpool, // Address of a smartcontract
		address _app,        // Address of a smartcontract
		address _dataset)    // Address of a smartcontract
	internal returns (uint256);

	function claimFailedConsensus(
		address _woid)
	public returns (bool);

	function finalizeWorkOrder(
		address _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool);

	function getCategoryWorkClockTimeRef(
		uint256 _catId)
	public view returns (uint256 workClockTimeRef);

	function existingCategory(
		uint256 _catId)
	public view  returns (bool categoryExist);

	function getCategory(
		uint256 _catId)
		public view returns (uint256 catid, string name, string  description, uint256 workClockTimeRef);

	function getWorkerStatus(
		address _worker)
	public view returns (address workerPool, uint256 workerScore);

	function getWorkerScore(address _worker) public view returns (uint256 workerScore);

	function registerToPool(address _worker) public returns (bool subscribed);

	function unregisterFromPool(address _worker) public returns (bool unsubscribed);

	function evictWorker(address _worker) public returns (bool unsubscribed);

	function removeWorker(address _workerpool, address _worker) internal returns (bool unsubscribed);

	function lockForOrder(address _user, uint256 _amount) public returns (bool);

	function unlockForOrder(address _user, uint256 _amount) public returns (bool);

	function lockForWork(address _woid, address _user, uint256 _amount) public returns (bool);

	function unlockForWork(address _woid, address _user, uint256 _amount) public returns (bool);

	function rewardForWork(address _woid, address _worker, uint256 _amount, bool _reputation) public returns (bool);

	function seizeForWork(address _woid, address _worker, uint256 _amount, bool _reputation) public returns (bool);

	function deposit(uint256 _amount) external returns (bool);

	function withdraw(uint256 _amount) external returns (bool);

	function checkBalance(address _owner) public view returns (uint256 stake, uint256 locked);

	function reward(address _user, uint256 _amount) internal returns (bool);

	function seize(address _user, uint256 _amount) internal returns (bool);

	function lock(address _user, uint256 _amount) internal returns (bool);

	function unlock(address _user, uint256 _amount) internal returns (bool);
}
