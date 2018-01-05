pragma solidity ^0.4.18;


contract IWorkerPool {

        // Pool management
        function changeRegistrationStatus(address worker, bool isAllowed);
        function changeStakePolicyRatio(uint newstakePolicyRatio);
        function changeRegistrationStatuses(address[] workers, bool isAllowed);
        function isWorkerAllowed( address worker) returns (bool) ;
        function isWorkerRegistered( address worker) returns (bool) ;
        function getWorkersCount() constant returns (uint) ;
        function getWorkerAddress(uint _index) constant returns (address);
        function getWorkerIndex( address worker) constant returns (uint);
        function addWorker(address worker) public onlyPoco returns (bool);
        function removeWorker(address worker) public onlyPoco returns (bool);

        // Task management
        function submitedTask(bytes32 _taskID,address dapp, tring taskParam, uint reward,uint trust, bool dappCallback) public onlyPoco returns (bool);
        function acceptTask(bytes32 _taskID) public onlyOwner /*=onlySheduler*/  returns (bool);
        function claimAcceptedTask ;
        function cancelTask ;
        function callForContribution(bytes32 _taskID, address worker ) public onlyOwner /*=onlySheduler*/ returns (bool) ;
        function contribute(bytes32 _taskID, uint256 _resultHash, uint256 _resultSaltedHash) public;
        function revealConsensus(bytes32 _taskID, uint consensus ) public
        function reveal(bytes32 _taskID, uint256 _result, uint256 _salt ) public;
        function finalizedTask(bytes32 _taskID, string stdout, string stderr, string uri) public onlyOwner /*=onlySheduler*/ returns (bool) ;

}
