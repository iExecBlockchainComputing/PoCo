pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import './IexecHub.sol';
import "./SafeMathOZ.sol";
import "./AuthorizedList.sol";
import "./Contributions.sol";

contract WorkerPool is OwnableOZ, IexecHubAccessor // Owned by a S(w)
{
	using SafeMathOZ for uint256;

	enum WorkerPoolStatusEnum { OPEN, CLOSE }

	event WorkerPoolPolicyUpdate(
		uint256 oldStakeRatioPolicy,               uint256 newStakeRatioPolicy,
		uint256 oldSchedulerRewardRatioPolicy,     uint256 newSchedulerRewardRatioPolicy,
		uint256 oldSubscriptionMinimumStakePolicy, uint256 newSubscriptionMinimumStakePolicy,
		uint256 oldSubscriptionMinimumScorePolicy, uint256 newSubscriptionMinimumScorePolicy);

	/**
	 * Members
	 */
	string                      public m_name;
	uint256                     public m_stakeRatioPolicy;               // % of reward to stake
	uint256                     public m_schedulerRewardRatioPolicy;     // % of reward given to scheduler
	uint256                     public m_subscriptionLockStakePolicy;    // Stake locked when in workerpool - Constant set by constructor, do not update
	uint256                     public m_subscriptionMinimumStakePolicy; // Minimum stake for subscribing
	uint256                     public m_subscriptionMinimumScorePolicy; // Minimum score for subscribing
	bool                				public m_enclaveGuarantee;
	WorkerPoolStatusEnum        public m_workerPoolStatus;
	address[]                   public m_workers;
	// mapping(address => index)
	mapping(address => uint256) public m_workerIndex;
	/**
	 * Address of slave/related contracts
	 */
	address                     public m_workersAuthorizedListAddress;
	address                     private m_workerPoolHubAddress;

	modifier onlyWorkerPoolHub()
	{
		require(msg.sender == m_workerPoolHubAddress);
		_;
	}

	/**
	 * Methods
	 */

	// Constructor
	function WorkerPool(
		address _iexecHubAddress,
		string  _name,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy,
		bool    _enclaveGuarantee)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender ==  WorkerPoolHub
		require(tx.origin != msg.sender);
		transferOwnership(tx.origin); // owner → tx.origin

		m_name                           = _name;
		m_stakeRatioPolicy               = 30; // % of the task price to stake → cf function SubmitTask
		m_schedulerRewardRatioPolicy     = 1;  // % of the task reward going to scheduler vs workers reward
		m_subscriptionLockStakePolicy    = _subscriptionLockStakePolicy; // only at creation. cannot be change to respect lock/unlock of worker stake
		m_subscriptionMinimumStakePolicy = _subscriptionMinimumStakePolicy;
		m_subscriptionMinimumScorePolicy = _subscriptionMinimumScorePolicy;
		m_enclaveGuarantee               = _enclaveGuarantee;
		m_workerPoolStatus               = WorkerPoolStatusEnum.OPEN;
		m_workerPoolHubAddress           = msg.sender;

		/* cannot do the following AuthorizedList contracts creation because of :
		   VM Exception while processing transaction: out of gas at deploy.
		   use attach....AuthorizedListContract instead function
		*/
   /*
	  workersAuthorizedListAddress = new AuthorizedList();
	  AuthorizedList(workersAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin
		dappsAuthorizedListAddress = new AuthorizedList();
		AuthorizedList(dappsAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin
		requesterAuthorizedListAddress = new AuthorizedList();
		AuthorizedList(requesterAuthorizedListAddress).transferOwnership(tx.origin); // owner → tx.origin
		*/
	}

	function attachWorkerPoolsAuthorizedListContract(address _workerPoolsAuthorizedListAddress) public onlyOwner
	{
 		m_workersAuthorizedListAddress = _workerPoolsAuthorizedListAddress;
 	}

	function changeWorkerPoolPolicy(
		uint256 _newStakeRatioPolicy,
		uint256 _newSchedulerRewardRatioPolicy,
		uint256 _newResultRetentionPolicy,
		uint256 _newSubscriptionMinimumStakePolicy,
		uint256 _newSubscriptionMinimumScorePolicy)
	public onlyOwner
	{
		WorkerPoolPolicyUpdate(
			m_stakeRatioPolicy,               _newStakeRatioPolicy,
			m_schedulerRewardRatioPolicy,     _newSchedulerRewardRatioPolicy,
			m_subscriptionMinimumStakePolicy, _newSubscriptionMinimumStakePolicy,
			m_subscriptionMinimumScorePolicy, _newSubscriptionMinimumScorePolicy
		);
		m_stakeRatioPolicy               = _newStakeRatioPolicy;
		m_schedulerRewardRatioPolicy     = _newSchedulerRewardRatioPolicy;
		m_subscriptionMinimumStakePolicy = _newSubscriptionMinimumStakePolicy;
		m_subscriptionMinimumScorePolicy = _newSubscriptionMinimumScorePolicy;
	}

	function getWorkerPoolOwner() public view returns (address)
	{
		return m_owner;
	}

	/************************* worker list management **************************/
	function isWorkerAllowed(address _worker) public view returns (bool)
	{
		return AuthorizedList(m_workersAuthorizedListAddress).isActorAllowed(_worker);
	}

	function getWorkerAddress(uint _index) constant public returns (address)
	{
		return m_workers[_index];
	}
	function getWorkerIndex(address _worker) constant public returns (uint)
	{
		uint index = m_workerIndex[_worker];
		require(m_workers[index] == _worker);
		return index;
	}
	function getWorkersCount() constant public returns (uint)
	{
		return m_workers.length;
	}
	function addWorker(address _worker) public onlyWorkerPoolHub  returns (bool)
	{
		uint index = m_workers.push(_worker);
		m_workerIndex[_worker] = index;
		return true;
	}
	function removeWorker(address _worker) public onlyWorkerPoolHub returns (bool)
	{
		uint index = getWorkerIndex(_worker); // fails if worker not registered
		m_workers[index] = m_workers[m_workers.length-1];
		delete m_workers[m_workers.length-1];
		m_workers.length--;
		return true;
	}

	/************************* open / close mechanisms *************************/
	/*
	function open() public onlyIexecHub returns (bool)
	{
		require(m_workerPoolStatus == WorkerPoolStatusEnum.CLOSE);
		m_workerPoolStatus = WorkerPoolStatusEnum.OPEN;
		return true;
	}

	function close() public onlyIexecHub returns (bool)
	{
		require(m_workerPoolStatus == WorkerPoolStatusEnum.OPEN);
		m_workerPoolStatus = WorkerPoolStatusEnum.CLOSE;
		return true;
	}
	*/

	function switchOnOff(bool onoff) public onlyIexecHub /*for staking management*/ returns (bool)
	{
		if(onoff){
			require(m_workerPoolStatus == WorkerPoolStatusEnum.CLOSE);
			m_workerPoolStatus = WorkerPoolStatusEnum.OPEN;
		}
		else{
			require(m_workerPoolStatus == WorkerPoolStatusEnum.OPEN);
			m_workerPoolStatus = WorkerPoolStatusEnum.CLOSE;
		}
		return true;
	}

	function isOpen() public view returns (bool)
	{
		return m_workerPoolStatus == WorkerPoolStatusEnum.OPEN;
	}

	/**************************** tasks management *****************************/
	function acceptTask(address _taskID, uint256 _taskCost) public onlyIexecHub returns (address taskContributions)
	{
		// when 2 cannot be divide by 3 for ratio calculus ?
		uint256 schedulerReward  = _taskCost.percentage(m_schedulerRewardRatioPolicy);
		uint256 workersReward    = _taskCost.sub(schedulerReward);
		address newContributions = new Contributions(
			iexecHubAddress,
			_taskID,
			workersReward,
			schedulerReward,
			_taskCost.percentage(m_stakeRatioPolicy),
			m_enclaveGuarantee
		);
		return newContributions;
	}







}
