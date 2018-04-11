These are the results from the analysis. The summary of the warning and the suggestions will be made at the beginning.

Analysis for the 19 contracts is made, 14 warnings are made, and all of them are either "Integer Underflow" or "Integer Underflow", no other issues. They share similiar causes can be summarized into 2 main reasons and other small reasons.

1st, it is the using of the variable type string, we can spot several warnings on cause of passing 115792089237316195423570985008687907853269984665640564039457584007913129639935 (2^256-1) or a number close (2^255,825441648 in IexecHub) to a string , due to lack of knowledge of the oyente, the exact cause of this phenomenon is unknown, yet one modification is still recommended: set a limitation of length when the customers are inputting the words and make sure that the input doesn't surpass it. Another suggestion for improving the performance of the contract, this doesn't help to eliminate the warning (the resultSign in the WorkerPool is a bytes32 and still causes the warning of overflow), however, according to http://solidity.readthedocs.io/en/develop/types.html#dynamically-sized-byte-array:

As a rule of thumb, use bytes for arbitrary-length raw byte data and string for arbitrary-length string (UTF-8) data. If you can limit the length to a certain number of bytes, always use one of bytes1 to bytes32 because they are much cheaper.

2nd, it occurs every time when an uint256 is involved. In this case, most of the times the warning can be ignored; if it is time-related, it is very unlikely to reach 2^256 seconds; if it is related to calculation, due to the using of SafeMath, the calculation itself should be safe, however, any manual input is suggested be examined. Some warnings occurs when taking in a 0 (e.g. workerpool in Marketplace), however, these are commented "BID can use null for any", so it should be fine; 5 occurs in the workerPool when "m_contributions = 4", due to lack of knowledge of the oyente, it remains unknown why this is a cause of warning; several occur with mapping, yet mapping is to searching for the existing data with the given variable, so the given variable should be controlled.


INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 44.6%
INFO:symExec:	  Integer Underflow: 			 True
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/App.sol:12:2: Warning: Integer Underflow.  
	string        public m_appName                                             # use bytes32 instead of string/limit the input in 32 bytes.
/home/hantong/Documents/test/PoCo/contracts/App.sol:14:2: Warning: Integer Underflow.   
	string        public m_appParams                                           # use bytes32 instead of string/limit the input in 32 bytes.
INFO:symExec:	====== Analysis Completed ======


AppHub.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 22.7%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 True
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/AppHub.sol:50:2: Warning: Integer Overflow.
	function createApp(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _appName = 115792089237316195423570985008687907853269984665640564039457584007913129639935
INFO:symExec:	====== Analysis Completed ======

# 115792089237316195423570985008687907853269984665640564039457584007913129639935+1 = 2^256


Dataset.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 44.6%
INFO:symExec:	  Integer Underflow: 			 True
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/Dataset.sol:14:2: Warning: Integer Underflow.  
	string            public m_datasetParams
/home/hantong/Documents/test/PoCo/contracts/Dataset.sol:12:2: Warning: Integer Underflow.
	string            public m_datasetName
INFO:symExec:	====== Analysis Completed ======




DatasetHub.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 20.7%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 True
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/DatasetHub.sol:57:2: Warning: Integer Overflow.
	function createDataset(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _datasetName = 115792089237316195423570985008687907853269984665640564039457584007913129639935   # same problem as AppHub.sol resulting from Dataset.sol
INFO:symExec:	====== Analysis Completed ======



IexecAPI.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 19.6%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 True
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/IexecAPI.sol:19:2: Warning: Integer Overflow.
	function createTaskRequest(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _workOrderParam = 115792089237316195423570985008687907853269984665640564039457584007913129639935   # same problem as App.sol
/home/hantong/Documents/test/PoCo/contracts/IexecAPI.sol:36:2: Warning: Integer Overflow.
	function workOrderCallback(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _stdout = 115792089237316195423570985008687907853269984665640564039457584007913129639932    # same problem as App.sol
INFO:symExec:	====== Analysis Completed ======




IexecHub.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 41.0%
INFO:symExec:	  Integer Underflow: 			 True
INFO:symExec:	  Integer Overflow: 			 True
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:174:3: Warning: Integer Underflow.  ###
		CreateWorkerPool(tx.origin, newWorkerPool, _description)
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:51:2: Warning: Integer Underflow.   # mapping
	mapping(uint256 => IexecLib.Category) public m_categories
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:421:3: Warning: Integer Underflow.
		return (
		^
Spanning multiple lines.
Integer Underflow occurs if:
    m_categories = 1
    m_categories = 115792089237316195423570985008687907853269984665640564039457584007913129639935         ##########
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:592:3: Warning: Integer Overflow.   # using SafeMath so it should be fine
		m_accounts[_user].locked
Integer Overflow occurs if:
    m_accounts = 102596274307771523279836703492202596251163792102963888306208633038507681513472     #  = 2^255,825441648
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:425:3: Warning: Integer Overflow.
		m_categories[_catId].workClockTimeRef
Integer Overflow occurs if:
    m_categories = 115792089237316195423570985008687907853269984665640564039457584007913129639935 #####
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:580:30: Warning: Integer Overflow.       # marketplaceAddress comes from address(0)
		m_accounts[_user].locked = m_accounts[_user].locked
Integer Overflow occurs if:
    marketplaceAddress = 0
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:567:37: Warning: Integer Overflow.
		return (m_accounts[_owner].stake, m_accounts[_owner].locked                                 # come from the account m_accounts[_owner]
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:22:24: Warning: Integer Overflow.
	// uint private constant AP
Integer Overflow occurs if:
    m_accounts = 1
    _amount = 115792089237316195423570985008687907853269984665640564039457584007913129639935   # it's a comment.
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:190:3: Warning: Integer Overflow.
		CreateApp(tx.origin, newApp, _appName, _appPrice, _appParams)                              # use bytes32 instead of string. / limit value * remaining in 2^256
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:174:3: Warning: Integer Overflow.
		CreateWorkerPool(tx.origin, newWorkerPool, _description)                                   # use bytes32 instead of string. / limit value * remaining in 2^256
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:206:3: Warning: Integer Overflow.
		CreateDataset(tx.origin, newDataset, _datasetName, _datasetPrice, _datasetParams)          # use bytes32 instead of string. / limit value * remaining in 2^256
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:226:35: Warning: Integer Overflow.
		WorkOrder workorder = WorkOrder(emitWorkOrder(                                             # use bytes32 instead of string. / limit value * remaining in 2^256
		^
Spanning multiple lines.
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:411:10: Warning: Integer Overflow.
		return m_categories[_catId].workClockTimeRef
Integer Overflow occurs if:
    m_categories = 115792089237316195423570985008687907853269984665640564039457584007913129639935   #####
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:592:30: Warning: Integer Overflow.         # using SafeMath so it should be fine
		m_accounts[_user].locked = m_accounts[_user].locked
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:587:3: Warning: Integer Overflow.          # come from the account m_accounts[_owner]
		m_accounts[_user].locked
Integer Overflow occurs if:
    _amount = 0
    m_accounts = 0
    m_accounts = 0
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:587:30: Warning: Integer Overflow.         # using SafeMath so it should be fine
		m_accounts[_user].locked = m_accounts[_user].locked
Integer Overflow occurs if:
    m_accounts = 0
    _amount = 0
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:142:2: Warning: Integer Overflow.
	function createCategory(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _name = 115792089237316195423570985008687907853269984665640564039457584007913129639935      # use bytes32 instead of string.
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:580:3: Warning: Integer Overflow.
		m_accounts[_user].locked
Integer Overflow occurs if:
    m_accounts = 0                                                                              # come from the account m_accounts[_owner]
    _amount = 0
    marketplaceAddress = 0                                                                      # marketplaceAddress comes from address(0)
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:213:2: Warning: Integer Overflow.
	function buyForWorkOrder(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _params = 115792089237316195423570985008687907853269984665640564039457584007913129639935    #####
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:349:2: Warning: Integer Overflow.
	function finalizeWorkOrder(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _stdout = 115792089237316195423570985008687907853269984665640564039457584007913129639935   #####
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:194:2: Warning: Integer Overflow.
	function createDataset(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _datasetName = 115792089237316195423570985008687907853269984665640564039457584007913129639935   #####
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:51:2: Warning: Integer Overflow.  # mapping
	mapping(uint256 => IexecLib.Category) public m_categories
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:178:2: Warning: Integer Overflow.
	function createApp(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _appName = 115792089237316195423570985008687907853269984665640564039457584007913129639935    #####
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:424:3: Warning: Integer Overflow.
		m_categories[_catId].description
Integer Overflow occurs if:
    m_categories = 115792089237316195423570985008687907853269984665640564039457584007913129639935    #####
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:423:3: Warning: Integer Overflow.
		m_categories[_catId].name
Integer Overflow occurs if:
    m_categories = 115792089237316195423570985008687907853269984665640564039457584007913129639935    #####
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:63:2: Warning: Integer Overflow.
	mapping(address => IexecLib.Account) public m_accounts                                           # come from the account m_accounts[_owner]
/home/hantong/Documents/test/PoCo/contracts/IexecHub.sol:158:2: Warning: Integer Overflow.
	function createWorkerPool(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _description = 115792089237316195423570985008687907853269984665640564039457584007913129639935    #####
INFO:symExec:	====== Analysis Completed ======



IexecHubAccessor.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 100.0%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:	====== Analysis Completed ======


IexecHubInterface.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 100.0%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:	====== Analysis Completed ======

IexecLib.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 100.0%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:	====== Analysis Completed ======

Marketplace.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 79.9%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 True
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:274:4: Warning: Integer Overflow.  # uint256 trust,
			marketorder.trust
Integer Overflow occurs if:
    m_orderBook = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:281:4: Warning: Integer Overflow.  ###
			marketorder.workerpool
Integer Overflow occurs if:
    m_orderBook = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:253:10: Warning: Integer Overflow.   # uint256 trust,
		return m_orderBook[_marketorderIdx].trust
Integer Overflow occurs if:
    m_orderBook = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:277:4: Warning: Integer Overflow.
			marketorder.value
Integer Overflow occurs if:
    m_orderBook = 115792089237316195423570985008687907853269984665640564039457584007913129639935  ###
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:109:74: Warning: Integer Overflow.
			require(iexecHubInterface.unlockForOrder(marketorder.workerpoolOwner, marketorder.value    # limit _value * _volume in 2^256
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:173:7: Warning: Integer Overflow.
		if (marketorder.remaining
Integer Overflow occurs if:
    _workerpool = 0                                                                              # // BID can use null for any
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:279:4: Warning: Integer Overflow.
			marketorder.remaining
Integer Overflow occurs if:
    m_orderBook = 115792089237316195423570985008687907853269984665640564039457584007913129639935   ###
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:273:4: Warning: Integer Overflow.
			marketorder.category
Integer Overflow occurs if:
    m_orderBook = 115792089237316195423570985008687907853269984665640564039457584007913129639935   ###
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:109:96: Warning: Integer Overflow.
			require(iexecHubInterface.unlockForOrder(marketorder.workerpoolOwner, marketorder.value.mul(marketorder.remaining   # limit _value * _volume in 2^256
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:234:10: Warning: Integer Overflow.
		return m_orderBook[_marketorderIdx].category                                                ####
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:172:27: Warning: Integer Overflow.
		marketorder.remaining = marketorder.remaining
Integer Overflow occurs if:
    _workerpool = 0                                                                              # // BID can use null for any
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:243:10: Warning: Integer Overflow.
		return m_orderBook[_marketorderIdx].value
Integer Overflow occurs if:
    m_orderBook = 115792089237316195423570985008687907853269984665640564039457584007913129639935  ###
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:109:45: Warning: Integer Overflow.
			require(iexecHubInterface.unlockForOrder(marketorder.workerpoolOwner                #  // BID can use null for any  / limit value * remaining in 2^256
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:248:10: Warning: Integer Overflow.
		return m_orderBook[_marketorderIdx].category
Integer Overflow occurs if:
    m_orderBook = 115792089237316195423570985008687907853269984665640564039457584007913129639935  ###
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:16:2: Warning: Integer Overflow.
	mapping(uint =>IexecLib.MarketOrder) public m_orderBook                                # mapping
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:282:4: Warning: Integer Overflow.
			marketorder.workerpoolOwner
Integer Overflow occurs if:
    m_orderBook = 115792089237316195423570985008687907853269984665640564039457584007913129639935   ###
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:278:4: Warning: Integer Overflow.
			marketorder.volume
Integer Overflow occurs if:
    m_orderBook = 115792089237316195423570985008687907853269984665640564039457584007913129639935    ###
/home/hantong/Documents/test/PoCo/contracts/Marketplace.sol:172:3: Warning: Integer Overflow.
		marketorder.remaining
Integer Overflow occurs if:
    _workerpool = 0                                                # // BID can use null for any
INFO:symExec:	====== Analysis Completed ======


MarketplaceAccessor.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 100.0%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:	====== Analysis Completed ======

MarketplaceInterface.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 100.0%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:	====== Analysis Completed ======

Migrations.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 98.6%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:	====== Analysis Completed ======

OwnableOZ.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 99.5%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:	====== Analysis Completed ======

SafeMathOZ.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 100.0%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:	====== Analysis Completed ======

TestSha.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 64.3%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 True
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/TestSha.sol:21:2: Warning: Integer Overflow.
	function testSolidityKeccak256FromString(string _input) public
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _input = 115792089237316195423570985008687907853269984665640564039457584007913129639932   #####
INFO:symExec:	====== Analysis Completed ======

WorkOrder.sol

INFO:root:contract /home/hantong/Documents/test/PoCo/contracts/WorkOrder.sol:WorkOrder:
INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 44.3%
INFO:symExec:	  Integer Underflow: 			 True
INFO:symExec:	  Integer Overflow: 			 True
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/WorkOrder.sol:28:2: Warning: Integer Underflow.  # use bytes32 instead of string/limit the input in 32 bytes.
	string  public m_stdout
/home/hantong/Documents/test/PoCo/contracts/WorkOrder.sol:24:2: Warning: Integer Underflow.               # use bytes32 instead of string/limit the input in 32 bytes.
	string  public m_params
/home/hantong/Documents/test/PoCo/contracts/WorkOrder.sol:29:2: Warning: Integer Underflow.               # use bytes32 instead of string/limit the input in 32 bytes.
	string  public m_stderr
/home/hantong/Documents/test/PoCo/contracts/WorkOrder.sol:30:2: Warning: Integer Underflow.               # use bytes32 instead of string/limit the input in 32 bytes.
	string  public m_uri
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/WorkOrder.sol:104:2: Warning: Integer Overflow.
	function setResult(string _stdout, string _stderr, string _uri) public onlyIexecHub
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _stdout = 115792089237316195423570985008687907853269984665640564039457584007913129639935              # use bytes32 instead of string/limit the input in 32 bytes.
INFO:symExec:	====== Analysis Completed ======


WorkOrderHub.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 81.0%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 False
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:	====== Analysis Completed ======

WorkerPool.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 57.6%
INFO:symExec:	  Integer Underflow: 			 True
INFO:symExec:	  Integer Overflow: 			 True
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:20:2: Warning: Integer Underflow.   # use bytes32 instead of string/limit the input in 32 bytes.
	string                      public m_description
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:191:4: Warning: Integer Overflow.   # ?
			consensus.revealCounter
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:227:4: Warning: Integer Overflow.                # ?
			contribution.score
Integer Overflow occurs if:
    m_contributions = 4
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:254:19: Warning: Integer Overflow.      # too many contributors?
		for (i = 0; i < consensus.contributors
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:309:5: Warning: Integer Overflow.       # workerScore too high?
		(,contribution.score
Integer Overflow occurs if:
    _resultSign = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    _resultHash = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:228:4: Warning: Integer Overflow.      # ?
			contribution.weight
Integer Overflow occurs if:
    m_contributions = 4
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:367:3: Warning: Integer Overflow.      # in the far future
		consensus.revealDate
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:168:24: Warning: Integer Overflow.     # too many workers?
		address lastWorker = m_workers[m_workers.length.sub(1)]
Integer Overflow occurs if:
    m_workers = 115792089237316195423570985008687907853269984665640564039457584007913129639930
    _worker = 0
    m_workerIndex = 115792089237316195423570985008687907853269984665640564039457584007913129639929
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:334:3: Warning: Integer Overflow.               # limit the input in 32 bytes.
		consensus.consensus
Integer Overflow occurs if:
    _consensus = 0
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 0
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:335:3: Warning: Integer Overflow.               # ?
		consensus.revealDate
Integer Overflow occurs if:
    _consensus = 0
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 0
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:366:3: Warning: Integer Overflow.              # limit the input.
		consensus.consensus
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:329:29: Warning: Integer Overflow.             # limit the input.
				consensus.winnerCount = consensus.winnerCount
Integer Overflow occurs if:
    _consensus = 0
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 0
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:189:4: Warning: Integer Overflow.         # limit it in 2^256
			consensus.consensus
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:199:10: Warning: Integer Overflow.        # limit it in 2^256
		return m_consensus[_woid].contributors
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:256:8: Warning: Integer Overflow.         # limit it in 2^256
			w = consensus.contributors[i]
Integer Overflow occurs if:
    m_contributions = 1
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:225:4: Warning: Integer Overflow.         # ?
			contribution.resultSign
Integer Overflow occurs if:
    m_contributions = 4
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:141:16: Warning: Integer Overflow.    # too many workers
		uint index = m_workers.push(msg.sender)
Integer Overflow occurs if:
    m_workers = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:256:8: Warning: Integer Overflow.     # too many contributors
			w = consensus.contributors
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:300:7: Warning: Integer Overflow.     # keccak256(_resultHash ^ _resultSign) may be too large (bytes32*bytes32)
		if (contribution.enclaveChallenge
Integer Overflow occurs if:
    _resultSign = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    _resultHash = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:371:16: Warning: Integer Overflow.    # contributors.length is larger than 2^256
			address w = consensus.contributors
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:21:2: Warning: Integer Overflow.      # ?
	uint2
Integer Overflow occurs if:
    _consensus = 0
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 0
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:372:48: Warning: Integer Overflow.  # too many contributors (w);
			if (m_contributions[_woid][w].resultHash == consensus.consensus
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:326:16: Warning: Integer Overflow.
			address w = consensus.contributors[i]
Integer Overflow occurs if:
    _consensus = 0
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:365:3: Warning: Integer Overflow.  # too many winners
		consensus.winnerCount
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:224:4: Warning: Integer Overflow.  # ?
			contribution.resultHash
Integer Overflow occurs if:
    m_contributions = 4
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:226:4: Warning: Integer Overflow.  # ?
			contribution.enclaveChallenge
Integer Overflow occurs if:
    m_contributions = 4
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:12:1: Warning: Integer Overflow.
contract WorkerPool is OwnableOZ, IexecHubAccessor, MarketplaceAccessor // Owned by a S(w)
^
Spanning multiple lines.
Integer Overflow occurs if:
    _resultSign = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    _resultHash = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:372:8: Warning: Integer Overflow.
			if (m_contributions[_woid][w].resultHash
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:193:4: Warning: Integer Overflow.
			consensus.winnerCount
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:326:16: Warning: Integer Overflow.# ?
			address w = consensus.contributors
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:362:42: Warning: Integer Overflow.# in the far future?
		require(consensus.revealDate <= now && consensus.revealCounter
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:188:4: Warning: Integer Overflow. # too many stake
			consensus.stakeAmount
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:26:2: Warning: Integer Overflow.
	address[]                   public m_workers
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:265:2: Warning: Integer Overflow.
	function allowWorkersToContribute(address _woid, address[] _workers, address _enclaveChallenge) public onlyOwner /*onlySheduler*/ returns (bool)
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _workers = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:30:2: Warning: Integer Overflow.   # mapping
	mapping(address => IexecLib.Consensus) public m_consensus
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:323:3: Warning: Integer Overflow.       # too many winners
		consensus.winnerCount
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:124:10: Warning: Integer Overflow.
		return m_workers[_index]
Integer Overflow occurs if:
    _index = 115792089237316195423570985008687907853184914073910329423591740356055187587071
    m_workers = 115792089237316195423570985008687907853184914073910329423591740356055187587072
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:327:8: Warning: Integer Overflow.
			if (m_contributions[_woid][w].resultHash
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:310:3: Warning: Integer Overflow.          # too many contributors
		consensus.contributors
Integer Overflow occurs if:
    _resultSign = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    _resultHash = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:204:10: Warning: Integer Overflow.     # control the index, m_workers.push(msg.sender);
		return m_consensus[_woid].contributors[index]
Integer Overflow occurs if:
    index = 115792089237316195423570985008687907853269984665640564039457584007913129639934
    index = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:369:27: Warning: Integer Overflow.     # too many contributors
		for (uint256 i = 0; i < consensus.contributors
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:329:5: Warning: Integer Overflow.      # too many winners
				consensus.winnerCount
Integer Overflow occurs if:
    _consensus = 0
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    m_contributions = 0
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:190:4: Warning: Integer Overflow.  # maybe in the far future?
			consensus.revealDate
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:381:2: Warning: Integer Overflow.
	function finalizeWork(address _woid, string _stdout, string _stderr, string _uri) public onlyOwner /*onlySheduler*/ returns (bool)
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _stdout = 115792089237316195423570985008687907853269984665640564039457584007913129639935           #bytes32 or limit
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:204:10: Warning: Integer Overflow.     # too many contributors
		return m_consensus[_woid].contributors
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:362:11: Warning: Integer Overflow.     # maybe in the far future?
		require(consensus.revealDate
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:310:3: Warning: Integer Overflow.      # too many contributors?
		consensus.contributors.push(msg.sender)
Integer Overflow occurs if:
    _resultSign = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    _resultHash = 115792089237316195423570985008687907853269984665640564039457584007913129639935
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:32:2: Warning: Integer Overflow.      # mapping
	mapping(address => mapping(address => IexecLib.Contribution)) public m_contributions
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:324:25: Warning: Integer Overflow.    # too many contributors?
		for (uint256 i = 0; i<consensus.contributors
/home/hantong/Documents/test/PoCo/contracts/WorkerPool.sol:192:4: Warning: Integer Overflow.     # uint256
			consensus.consensusTimout
INFO:symExec:	====== Analysis Completed ======


WorkerPoolHub.sol

INFO:symExec:	============ Results ===========
INFO:symExec:	  EVM Code Coverage: 			 10.1%
INFO:symExec:	  Integer Underflow: 			 False
INFO:symExec:	  Integer Overflow: 			 True
INFO:symExec:	  Parity Multisig Bug 2: 		 False
INFO:symExec:	  Callstack Depth Attack Vulnerability:  False
INFO:symExec:	  Transaction-Ordering Dependence (TOD): False
INFO:symExec:	  Timestamp Dependency: 		 False
INFO:symExec:	  Re-Entrancy Vulnerability: 		 False
INFO:symExec:/home/hantong/Documents/test/PoCo/contracts/WorkerPoolHub.sol:60:2: Warning: Integer Overflow.
	function createWorkerPool(
	^
Spanning multiple lines.
Integer Overflow occurs if:
    _description = 115792089237316195423570985008687907853269984665640564039457584007913129639935    #use bytes32 instead of string / limit the input
INFO:symExec:	====== Analysis Completed ======
