pragma solidity ^0.4.18;



contract IWorkerPoolHub {

    function getPoolCount() view returns (uint) ;

    function getPoolAddress(uint _index) view returns (address);

    function createPool(string name) returns(address poolAddress);

    function subscribeToPool(address poolAddress) returns(address poolAddress) ;

    function unsubscribeToPool(address poolAddress) returns(address poolAddress) ;


}
