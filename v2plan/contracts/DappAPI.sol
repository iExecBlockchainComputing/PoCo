pragma solidity ^0.4.18;


contract DappAPI is Ownable { //Owned by a D(w){


    address pocoAddress;

    event IexecSubmitCallback(bytes32 submitTxHash, address indexed user, string stdout, string uri);


    // TODO : D(w) can black white list of worker pool S(s)
    // TODO : D(w) can black white list of users U(w)

    //constructor
    function DappAPI(address _pocoAddress, uint256 dappPrice, string dappName) public {
        pocoAddress=_pocoAddress;
        Poco aPoco = Poco(pocoAddress);
        require(aPoco.registerDappAndProvider(dappPrice,dappName));
    }

    function iexecSubmit(address workerPool, string taskParam, uint taskCost, uint askedTrust, bool dappCallback) public {
        Poco aPoco = Poco(pocoAddress);
        require(iexecOracle.submitTask(workerPool,taskParam, taskCost, askedTrust, dappCallback));
    }

    function iexecSubmitCallback(bytes32 submitTxHash, address user, string stdout, string uri) public returns  (bool){
        //require(msg.sender == targetWorkerPool); // how to control that ?
        IexecSubmitCallback(submitTxHash,user,stdout,uri);
        return true;
    }
}
