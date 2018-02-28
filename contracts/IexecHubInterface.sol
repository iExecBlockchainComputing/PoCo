pragma solidity ^0.4.18;
import './IexecLib.sol';
contract IexecHubInterface
{

	function createWorkerPool(
		string  _name,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy)
	public returns (address createdWorkerPool);

	function createApp(
		string  _appName,
		uint256 _appPrice,
		string  _appParams)
		public returns (address createdApp);

	function createDataset(
		string  _datasetName,
		uint256 _datasetPrice,
		string  _datasetParams)
	public returns (address createdDataset);

	function createWorkOrder(
		address _workerPool,
		address _app,
		address _dataset,
		string  _workOrderParam,
		uint256 _workReward,
		uint256 _askedTrust,
		bool    _dappCallback,
		address _beneficiary)
	public returns (address createdWorkOrder);

	function acceptWorkOrder(
		address _woid)
	public returns (bool);

	function scheduleWorkOrder(
		address _woid)
	public returns (bool);

	function reopen(
		address _woid)
	public returns (bool);

	function startRevealingPhase(
		address _woid)
	public returns (bool);

	function cancelWorkOrder(
		address _woid)
	public returns (bool);

	function claimFailedConsensus(
		address _woid)
		public /*only who ? everybody ?*/ returns (bool);

	function finalizedWorkOrder(
		address _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool);

	function getWorkerStatus(
		address _worker)
	public view returns (address workerPool, uint256 workerScore);

	function getWorkReward(
		address _woid)
	public view returns (uint256 workReward);

	function openCloseWorkerPool(
		address _workerPool, bool open)
	public returns (bool);

	function subscribeToPool()
	public returns (bool subscribed);

	function unsubscribeToPool()
	public returns (bool unsubscribed);

	function evictWorker(
		address _worker)
	public returns (bool unsubscribed);

	function lockForWork(
		address _woid,
		address _user,
		uint256 _amount)
	public returns (bool);

	function lockForOrder(
		address _user,
		uint256 _amount)
	public returns (bool);

	function unlockForWork(
		address _woid,
		address _user,
		uint256 _amount)
	public returns (bool);

	function unlockForOrder(
		address _user,
		uint256 _amount)
	public returns (bool);

	function lockDepositForOrder(
		address _user,
		uint256 _amount)
	public returns (bool);

	function rewardForWork(
		address _woid,
		address _worker,
		uint256 _amount,
		bool    _reputation)
	public returns (bool);

	function rewardForOrder(
		address _worker,
		uint256 _amount)
	public returns (bool);

	function seizeForWork(
		address _woid,
		address _worker,
		uint256 _amount,
		bool    _reputation)
	public returns (bool);

	function seizeForOrder(
		address _worker,
		uint256 _amount)
	public returns (bool);

	function deposit(
		uint256 _amount)
	external returns (bool);

	function withdraw(
		uint256 _amount)
	external returns (bool);

	function checkBalance(
		address _owner)
	public view returns (uint256 stake, uint256 locked);

}
