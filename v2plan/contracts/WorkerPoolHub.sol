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
	//worker => workerPool
	mapping(address => address)                  m_workerAffectation;
	// owner => workerPools count
	mapping(address => uint256)                  m_workerPoolsCountByOwner;
	// owner => index => workerPool
	mapping(address => mapping(uint => address)) m_workerPoolByOwnerByIndex;
	//  workerPool => owner
	mapping(address => address)                  m_ownerByWorkerPool;

	/**
	 * Events
	 */
	event CreateWorkerPool(
		address indexed workerPoolOwner,
		address indexed pool,
		string  name
	);

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
		return m_workerPoolsCountByOwner[_owner];
	}

	function getWorkerPool(address _owner,uint256 _index) public view returns (address)
	{
		return m_workerPoolByOwnerByIndex[_owner][_index];
	}

	function getWorkerPoolOwner(address _workerPool) public view returns (address)
	{
		return m_ownerByWorkerPool[_workerPool];
	}

	function isWorkerPoolRegistred(address _workerPool) public view returns (bool)
	{
		return m_ownerByWorkerPool[_workerPool] != 0x0;
	}

	function createWorkerPool(string _name) public onlyOwner /*owner == IexecHub*/ returns(address createdWorkerPool)
	{
		// tx.origin == owner
		// msg.sender == IexecHub
		address newWorkerPool = new WorkerPool(msg.sender,_name);
		m_workerPoolsCountByOwner[tx.origin] = m_workerPoolsCountByOwner[tx.origin].add(1);
		m_workerPoolByOwnerByIndex[tx.origin][m_workerPoolsCountByOwner[tx.origin]] = newWorkerPool;
		m_ownerByWorkerPool[newWorkerPool] = tx.origin;
		CreateWorkerPool(tx.origin,newWorkerPool,_name);
		return newWorkerPool;
	}

	function subscribeToPool(address _workerPool) public onlyOwner /*owner == poco*/ returns(bool subscribed)
	{
		WorkerPool aPoolToSubscribe = WorkerPool(_workerPool);
		// you must be on the white list of the worker pool to subscribe.
		//require(aPoolToSubscribe.isWorkerAllowed(msg.sender)); TODO
		// you must have no cuurent affectation on others worker Pool
		require(m_workerAffectation[msg.sender] == 0x0);
		require(aPoolToSubscribe.addWorker(msg.sender));
		m_workerAffectation[msg.sender] = _workerPool;
		return true;
	}
	function unsubscribeToPool(address _workerPool) public onlyOwner /*owner == poco*/ returns(bool unsubscribed)
	{
		WorkerPool aPoolToUnSubscribe= WorkerPool(_workerPool);
		require(m_workerAffectation[msg.sender] == _workerPool );
		require(aPoolToUnSubscribe.removeWorker(msg.sender));
		m_workerAffectation[msg.sender] == 0x0;
		return true;
	}




}
