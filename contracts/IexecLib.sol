pragma solidity ^0.4.18;

library IexecLib{

    	enum WorkOrderStatusEnum
    	{
    		UNSET,
    		PENDING,
    		ACCEPTED,
    		CANCELLED,
    	  SCHEDULED,
    		REVEALING,// or RUNNING ?
    		CLAIMED,
    		COMPLETED
    	}


}
