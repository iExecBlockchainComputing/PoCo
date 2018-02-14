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
	mapping(address => address)   m_workerAffectation;
	// owner => index => workerPool
	mapping(address => address[]) m_workerPoolByOwnerByIndex;
	//  workerPool => owner
	mapping(address => address)   m_ownerByWorkerPool;

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
		return m_workerPoolByOwnerByIndex[_owner].length;
	}

	function getWorkerPool(address _owner, uint256 _index) public view returns (address)
	{
		return m_workerPoolByOwnerByIndex[_owner][_index];
	}

	function getWorkerPoolOwner(address _workerPool) public view returns (address)
	{
		return m_ownerByWorkerPool[_workerPool];
	}

	function getWorkerAffectation(address _worker) public view returns (address workerPool)
	{
		return m_workerAffectation[_worker];
	}

	function isWorkerPoolRegistred(address _workerPool) public view returns (bool)
	{
		return m_ownerByWorkerPool[_workerPool] != 0x0;
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
		m_workerPoolByOwnerByIndex[tx.origin].push(newWorkerPool);
		m_ownerByWorkerPool[newWorkerPool] = tx.origin;
		return newWorkerPool;
	}

	function subscribeToPool(address _workerPool) public onlyOwner /*owner == IexecHub*/ returns (bool subscribed)
	{
		WorkerPool pool = WorkerPool(_workerPool);
		// you must have no cuurent affectation on others worker Pool
		require(m_workerAffectation[tx.origin] == 0x0);
		// you must be on the white list of the worker pool to subscribe.
		require(pool.isWorkerAllowed(tx.origin));
		require(pool.addWorker(tx.origin));
		m_workerAffectation[tx.origin] = _workerPool;
		return true;
	}

	function unsubscribeToPool(address _workerPool, address _worker) public onlyOwner /*owner == IexecHub*/ returns (bool unsubscribed)
	{
		WorkerPool pool = WorkerPool(_workerPool);
		require(m_workerAffectation[_worker] == _workerPool );
		m_workerAffectation[_worker] == 0x0;
		if(_worker == tx.origin || m_ownerByWorkerPool[_workerPool] == tx.origin) // worker quit || scheduler expulse
		{
			require(pool.removeWorker(_worker));
			return true;
	 }
		 return false;
	}


}
