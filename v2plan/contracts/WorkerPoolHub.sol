pragma solidity ^0.4.18;

contract WorkerPoolHub {


  address[] workerPools;

  //worker => workerPool
  mapping (address => address) m_workerAffectation;

  mapping (address => address) m_registeredPools;


  event CreateWorkerPool(address scheduler,string name);


  function getPoolCount() view returns (uint) {
  return workerPools.length;
  }

  function getPoolAddress(uint _index) view returns (address){
  return workerPools[_index];
  }

  function createPool(string name) returns(address poolAddress) {
  address newPool = new WorkerPool(this,name);
  workerPools.push(newPool);
  CreateWorkerPool(msg.sender,name);
  // add a staking and lock for the msg.sender scheduler. in order to prevent against pool creation spam ?
  return newPool;
  }


  function subscribeToPool(address poolAddress) returns(address poolAddress) {
  WorkerPool aPool= WorkerPool(poolAddress);
  //you must be on the withe list of the worker pool to subribe.
  require(aPool.isWorkerAllowed(msg.sender));
  // you must have no cuurent affectation on others worker Pool
  require(m_workerAffectation[msg.sender] == 0x0);
  require(aPool.addWorker(msg.sender));
  m_workerAffectation[msg.sender] = poolAddress;
  return true;
  }

  function unsubscribeToPool(address poolAddress) returns(address poolAddress) {
  WorkerPool aPool= WorkerPool(poolAddress);
  require(m_workerAffectation[msg.sender] == poolAddress );
  require(aPool.removeWorker(msg.sender));
  m_workerAffectation[msg.sender] == 0x0;
  return true;
  }




}
