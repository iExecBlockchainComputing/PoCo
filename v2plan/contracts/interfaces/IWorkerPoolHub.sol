pragma solidity ^0.4.18;



contract IWorkerPoolHub {

    function getPoolCount() view public returns (uint) ;

    function getPoolAddress(uint _index) view public returns (address);

    function createPool(string name) public returns(address poolAddress);

    function subscribeToPool(address poolAddress) public returns(bool subscribed) ;

    function unsubscribeToPool(address poolAddress) public returns(bool unsubscribed) ;


}
