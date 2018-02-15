pragma solidity ^0.4.18;

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

	function createTaskRequest(
		address _workerPool,
		address _app,
		address _dataset,
		string  _taskParam,
		uint256 _taskReward,
		uint256 _askedTrust,
		bool    _dappCallback,
		address _beneficiary)
	public returns (address createdTaskRequest);

	function acceptTask(
		address _taskID)
	public returns (bool);

	function cancelTask(
		address _taskID)
	public returns (bool);

	function claimFailedConsensus(
		address _taskID)
		public /*only who ? everybody ?*/ returns (bool);

	function finalizedTask(
		address _taskID,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool);

	function getWorkerStatus(
		address _worker)
	public view returns (address workerPool, uint256 workerScore);

	function getTaskCost(
		address _taskID)
	public view returns (uint256 taskCost);

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

	function lockForTask(
		address _taskID,
		address _user,
		uint256 _amount)
	public returns (bool);

	function unlockForTask(
		address _taskID,
		address _user,
		uint256 _amount)
	public returns (bool);

	function rewardForConsensus(
		address _taskID,
		address _scheduler,
		uint256 _amount)
	public returns (bool);

	function rewardForTask(
		address _taskID,
		address _worker,
		uint256 _amount)
	public returns (bool);

	function seizeForTask(
		address _taskID,
		address _worker,
		uint256 _amount)
	public returns (bool);

	function deposit(
		uint256 _amount)
	public returns (bool);

	function withdraw(
		uint256 _amount)
	public returns (bool);

	function checkBalance(
		address _owner)
	public view returns (uint256 stake, uint256 locked);

}
