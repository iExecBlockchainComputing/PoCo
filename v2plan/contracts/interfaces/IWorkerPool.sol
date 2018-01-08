pragma solidity ^0.4.18;


contract IWorkerPool{

        // Pool management
        //TODO add function back list white list
        function getWorkersCount() constant public returns (uint) ;
        function getWorkerAddress(uint _index) constant public returns (address);
        function getWorkerIndex( address worker) constant public returns (uint);
        function addWorker(address worker) public returns (bool);
        function removeWorker(address worker) public returns (bool);

        // Task management
        function submitedTask(bytes32 _taskID,address dapp, string taskParam, uint reward,uint trust, bool dappCallback) public returns (bool);
        function acceptTask(bytes32 _taskID) public /*=onlySheduler*/  returns (bool);
        function claimAcceptedTask() public;
        function cancelTask() public;
        function callForContribution(bytes32 _taskID, address worker ) public  /*=onlySheduler*/ returns (bool) ;
        function contribute(bytes32 _taskID, uint256 _resultHash, uint256 _resultSaltedHash) public;
        function revealConsensus(bytes32 _taskID, uint256 consensus ) public;
        function reveal(bytes32 _taskID, uint256 _result, uint256 _salt ) public;
        function finalizedTask(bytes32 _taskID, string stdout, string stderr, string uri) public /*=onlySheduler*/ returns (bool) ;

}
