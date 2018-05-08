pragma solidity ^0.4.21;

import './IexecCallbackInterface.sol';
import './IexecLib.sol';
import './WorkOrder.sol';
contract CallbackProof {

  	event WorkOrderCallbackProof(address indexed woid, address requester, address beneficiary,address indexed callbackTo, address indexed gasCallbackProvider,string stdout, string stderr , string uri);

    //mapping(workorder => bool)
	   mapping(address => bool) m_callbackDone;
    /**
  	 * Constructor
  	 */
  	function CallbackProof()
  	public
  	{
  	}

    function isCallbackDone(address _woid) public view  returns (bool callbackDone)
    {
      return m_callbackDone[_woid];
    }

    function workOrderCallback(address _woid,string _stdout, string _stderr, string _uri) public
  	{
      require(!isCallbackDone(_woid));
      m_callbackDone[_woid] = true;
      require(WorkOrder(_woid).m_status() == IexecLib.WorkOrderStatusEnum.COMPLETED);
      require(WorkOrder(_woid).m_resultCallbackProof() == keccak256(_stdout,_stderr,_uri));
      address callbackTo =WorkOrder(_woid).m_callback();
      require(callbackTo != address(0));
      require(IexecCallbackInterface(callbackTo).workOrderCallback(
        _woid,
        _stdout,
        _stderr,
        _uri
      ));
  		emit WorkOrderCallbackProof(_woid,WorkOrder(_woid).m_requester(),WorkOrder(_woid).m_beneficiary(),callbackTo,tx.origin,_stdout,_stderr,_uri);
  	}
}
