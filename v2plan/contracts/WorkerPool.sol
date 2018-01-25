pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import './IexecHub.sol';
import "./SafeMathOZ.sol";
import "./AuthorizedList.sol";
import "./Contributions.sol";

contract WorkerPool is OwnableOZ, IexecHubAccessor//Owned by a S(w)
{
	using SafeMathOZ for uint256;

	enum WorkerPoolStatusEnum { OPEN, CLOSE }

  event WorkerPoolPolicyUpdate(uint256 oldStakeRatioPolicy, uint256 newStakeRatioPolicy , uint256 oldResultRetentionPolicyPolicy, uint256  newResultRetentionPolicyPolicy);

	/**
	 * Members
	 */
	string                                       public m_name;
	uint256                                      public m_schedulerRewardRatioPolicy;
	uint256                                      public m_stakeRatioPolicy;
	uint256                                      public m_resultRetentionPolicy;
	WorkerPoolStatusEnum                         public m_workerPoolStatus;
	address[]                                    public m_workers;
	// mapping(address=> index)
	mapping(address => uint256)                  public m_workerIndex;
	// mapping(taskID => TaskContributions address);
	//mapping(address => address)                     public m_tasks;

	address private m_workerPoolHubAddress;

	/**
	 * Address of slave contracts
	 */
	address public m_workersAuthorizedListAddress;

	modifier onlyWorkerPoolHub()
	{
		require(msg.sender == m_workerPoolHubAddress);
		_;
	}

	/**
	 * Methods
	 */

	//constructor
	function WorkerPool(
		address _iexecHubAddress,
		string  _name)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender ==  WorkerPoolHub
		require(tx.origin != msg.sender );
		transferOwnership(tx.origin); // owner → tx.origin

		m_name             = _name;
		m_schedulerRewardRatioPolicy = 10; //% of the task reward going to scheduler vs workers reward
		m_stakeRatioPolicy = 30; // % of the task price to stake → cf function SubmitTask
		m_resultRetentionPolicy  = 7 days;
		m_workerPoolStatus = WorkerPoolStatusEnum.OPEN;
		m_workerPoolHubAddress =msg.sender;


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


	function attachWorkerPoolsAuthorizedListContract(address _workerPoolsAuthorizedListAddress) public onlyOwner{
 		m_workersAuthorizedListAddress =_workerPoolsAuthorizedListAddress;
 	}

	function changeWorkerPoolPolicy(
	uint256 _newStakeRatioPolicy,
	uint256 _newResultRetentionPolicy
	)
	public onlyOwner
	{
		WorkerPoolPolicyUpdate(m_stakeRatioPolicy,_newStakeRatioPolicy,m_resultRetentionPolicy,_newResultRetentionPolicy);
		m_stakeRatioPolicy = _newStakeRatioPolicy;
		m_resultRetentionPolicy = _newResultRetentionPolicy;
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
	function open() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(m_workerPoolStatus == WorkerPoolStatusEnum.CLOSE);
		m_workerPoolStatus = WorkerPoolStatusEnum.OPEN;
		return true;
	}
	function close() public onlyIexecHub /*for staking management*/ returns (bool)
	{
		require(m_workerPoolStatus == WorkerPoolStatusEnum.OPEN);
		m_workerPoolStatus = WorkerPoolStatusEnum.CLOSE;
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
		uint256 schedulerReward =_taskCost.mul(m_schedulerRewardRatioPolicy).div(100);
		uint256 workersReward =_taskCost.mul(uint256(100).sub(m_schedulerRewardRatioPolicy)).div(100);
		assert(schedulerReward.add(workersReward) == _taskCost);
		address newContributions = new Contributions(iexecHubAddress,_taskID,workersReward,schedulerReward,_taskCost.mul(m_stakeRatioPolicy).div(100));
		return newContributions;
	}







}
