pragma solidity ^0.4.18;

contract IDappAPI{

  function iexecSubmit(address workerPool, string taskParam, uint taskCost, uint askedTrust, bool dappCallback) public ;

  // callback Optional. asked withbool dappCallback
  function iexecSubmitCallback(bytes32 submitTxHash, address user, string stdout, string uri) public returns  (bool);

}
