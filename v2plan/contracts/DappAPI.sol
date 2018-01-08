pragma solidity ^0.4.18;
import './Poco.sol';
import './interfaces/IDappAPI.sol';
import "rlc-token/contracts/Ownable.sol";


contract DappAPI is IDappAPI, Ownable { //Owned by a D(w){


    address pocoAddress;
    Poco aPoco;


    event IexecSubmitCallback(bytes32 submitTxHash, address indexed user, string stdout, string uri);
    // Add an indentity stake :the same as the worker and worker pool stake. To prevent from spam attack
    // Add an unregisterDappAndProvider function to unlock this identidy stake. or OPEN/CLOSE status for lock and unlock stake. to be stored in dappHub
    // TO ADD  enum DAPPStatusEnum{OPEN,CLOSE}
    // TODO : D(w) can black white list of worker pool S(s)
    // TODO : D(w) can black white list of users U(w)

    //constructor
    function DappAPI(address _pocoAddress, uint256 dappPrice, string dappName) public {
        pocoAddress=_pocoAddress;
        aPoco = Poco(pocoAddress);
        require(aPoco.registerDappAndProvider(dappPrice,dappName));
    }

    function iexecSubmit(address workerPool, string taskParam, uint taskCost, uint askedTrust, bool dappCallback) public {
        require(aPoco.submitTask(workerPool,taskParam, taskCost, askedTrust, dappCallback));
    }

    function iexecSubmitCallback(bytes32 submitTxHash, address user, string stdout, string uri) public returns  (bool){
        //require(msg.sender == targetWorkerPool); // how to control that ?
        IexecSubmitCallback(submitTxHash,user,stdout,uri);
        return true;
    }
}
