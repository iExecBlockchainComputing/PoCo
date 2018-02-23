pragma solidity ^0.4.18;

import './WorkerPool.sol';
import "./OwnableOZ.sol";
import "./SafeMathOZ.sol";

contract WorkerPoolHub is OwnableOZ // is Owned by IexecHub
{

	using SafeMathOZ for uint256;

	/**
	 * Members
	 */
	// worker => workerPool
	mapping(address => address)                     m_workerAffectation;
	// owner => index
	mapping(address => uint256)                     m_workerPoolCountByOwner;
	// owner => index => workerPool
	mapping(address => mapping(uint256 => address)) m_workerPoolByOwnerByIndex;
	//  workerPool => owner
	mapping(address => address)                     m_ownerByWorkerPool;

	/**
	 * Constructor
	 */
	function WorkerPoolHub() public
	{
	}

	/**
	 * Methods
	 */
	function getWorkerPoolsCount(address _owner) public view returns (uint256)
	{
		return m_workerPoolCountByOwner[_owner];
	}

	function getWorkerPool(address _owner, uint256 _index) public view returns (address)
	{
		return m_workerPoolByOwnerByIndex[_owner][_index];
	}
/*
	function getWorkerPoolOwner(address _workerPool) public view returns (address)
	{
		return m_ownerByWorkerPool[_workerPool];
	}
*/
	function getWorkerAffectation(address _worker) public view returns (address workerPool)
	{
		return m_workerAffectation[_worker];
	}

	function isWorkerPoolRegistred(address _workerPool) public view returns (bool)
	{
		return m_ownerByWorkerPool[_workerPool] != 0x0;
	}

	function addWorkerPool(address _owner, address _workerPool) internal
	{
		uint id = m_workerPoolCountByOwner[_owner];
		m_workerPoolCountByOwner  [_owner]      = id.add(1);
		m_workerPoolByOwnerByIndex[_owner][id]  = _workerPool;
		m_ownerByWorkerPool       [_workerPool] = _owner;
	}

	function createWorkerPool(
		string _name,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy)
		public onlyOwner /*owner == IexecHub*/ returns (address createdWorkerPool)
	{
		// tx.origin == owner
		// msg.sender == IexecHub
		address newWorkerPool = new WorkerPool(
			msg.sender,
			_name,
			_subscriptionLockStakePolicy,
			_subscriptionMinimumStakePolicy,
			_subscriptionMinimumScorePolicy
		);
		addWorkerPool(tx.origin, newWorkerPool);
		return newWorkerPool;
	}

	function subscribeToPool(address _workerPool) public onlyOwner /*owner == IexecHub*/ returns (bool subscribed)
	{
		//tx.origin = worker
		WorkerPool pool = WorkerPool(_workerPool);
		// you must have no cuurent affectation on others worker Pool
		require(m_workerAffectation[tx.origin] == 0x0);
		// you must be on the white list of the worker pool to subscribe.
		require(pool.isWorkerAllowed(tx.origin));
		m_workerAffectation[tx.origin] = _workerPool;
		return true;
	}

	function unsubscribeToPool(address _workerPool, address _worker) public onlyOwner /*owner == IexecHub*/ returns (bool unsubscribed)
	{
		WorkerPool pool = WorkerPool(_workerPool);
		require(m_workerAffectation[_worker] == _workerPool );
		m_workerAffectation[_worker] == 0x0;
		return true;
	}

	function isOpen(address _workerPool) public view returns (bool)
	{
		return WorkerPool(_workerPool).isOpen();
	}
	function isAppAllowed(address _workerPool, address _app) public returns (bool)
	{
		return WorkerPool(_workerPool).isAppAllowed(_app);
	}
	function isDatasetAllowed(address _workerPool, address _dataset) public returns (bool)
	{
		return WorkerPool(_workerPool).isDatasetAllowed(_dataset);
	}
	/*
	function isRequesterAllowed(address _workerPool, address _requester) public returns (bool)
	{
		return WorkerPool(_workerPool).isRequesterAllowed(_requester);
	}
	*/


}
