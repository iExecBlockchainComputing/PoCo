pragma solidity ^0.4.18;

import './WorkerPool.sol';
import "rlc-token/contracts/Ownable.sol";

contract WorkerPoolHub is Ownable { // TODO change owner to poco at migrate


  address[] workerPools;

  //worker => workerPool
  mapping (address => address) m_workerAffectation;

  mapping (address => address) m_registeredPools;


  event CreateWorkerPool(address scheduler,string name);


  function getPoolCount() view public returns (uint) {
  return workerPools.length;
  }

  function getPoolAddress(uint _index) view public returns (address){
  return workerPools[_index];
  }

  function createPool(string name) public onlyOwner /*owner == poco*/ returns(address poolAddress) {
  address newPool = new WorkerPool(owner,name);
  workerPools.push(newPool);
  CreateWorkerPool(msg.sender,name);
  // add a staking and lock for the msg.sender scheduler. in order to prevent against pool creation spam ?
  return newPool;
  }


  function subscribeToPool(address poolAddress) public  returns(bool subscribed) {
  WorkerPool aPoolToSubscribe= WorkerPool(poolAddress);
  //you must be on the withe list of the worker pool to subribe.
  require(aPoolToSubscribe.isWorkerAllowed(msg.sender));
  // you must have no cuurent affectation on others worker Pool
  require(m_workerAffectation[msg.sender] == 0x0);
  require(aPoolToSubscribe.addWorker(msg.sender));
  m_workerAffectation[msg.sender] = poolAddress;
  return true;
  }

   function unsubscribeToPool(address poolAddress) public  returns(bool unsubscribed) {
   WorkerPool aPoolToUnSubscribe= WorkerPool(poolAddress);
  require(m_workerAffectation[msg.sender] == poolAddress );
  require(aPoolToUnSubscribe.removeWorker(msg.sender));
  m_workerAffectation[msg.sender] == 0x0;
  return true;
  }



}
