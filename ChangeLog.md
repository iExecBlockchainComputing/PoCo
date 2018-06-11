

### backlog
Features:
 * [#17](https://github.com/iExecBlockchainComputing/PoCo/issues/17): do not revert bad reveal but store it to a wrong status            [POST V2]
 * [#19](https://github.com/iExecBlockchainComputing/PoCo/issues/19): MarketOrder (Direction & Status)                                   [GO/NOGO]
 * [#22](https://github.com/iExecBlockchainComputing/PoCo/issues/22): allow to deposit on someone else's account                         [GO/NOGO]
 * [#23](https://github.com/iExecBlockchainComputing/PoCo/issues/23): rename createMarketOrder => createOrder || createWorkOrder         [GO/NOGO]

Bugfixes:


### v1.0.14 (not released)

Features:
 * [#42](https://github.com/iExecBlockchainComputing/PoCo/issues/42) ajust timeout categories
 * [#40](https://github.com/iExecBlockchainComputing/PoCo/issues/40)  Removing the build/ folder from git and create a specific one for contracts addresses deployed

 Bugfixes:
 * [#41](https://github.com/iExecBlockchainComputing/PoCo/issues/41) : truffle compile doesn't work


### [v1.0.13](https://github.com/iExecBlockchainComputing/PoCo/releases/tag/v1.0.13)

Features:
 * [#16](https://github.com/iExecBlockchainComputing/PoCo/issues/16) add counters info in Hub
 * [#21](https://github.com/iExecBlockchainComputing/PoCo/issues/21): remove change ownership in OwnableOZ.sol   

Bugfixes:
* [#24](https://github.com/iExecBlockchainComputing/PoCo/issues/24) : possibly useless RLC address getter
* [#15](https://github.com/iExecBlockchainComputing/PoCo/issues/15) :[CS AUDIT] Result without Payment. Malicious IexecAPI contract without callback
* [#25](https://github.com/iExecBlockchainComputing/PoCo/issues/25) :[CS AUDIT] Scheduler can manipulate its reward percentage
* [#26](https://github.com/iExecBlockchainComputing/PoCo/issues/26) :[CS AUDIT] Arbitrary Contract are trusted
* [#27](https://github.com/iExecBlockchainComputing/PoCo/issues/27) :[CS AUDIT] fix consensusTimout, failled typo to consensusTimeout, failed
* [#28](https://github.com/iExecBlockchainComputing/PoCo/issues/28) : Attacker can race to attach invalid hubs.
* [#29](https://github.com/iExecBlockchainComputing/PoCo/issues/29) : [CS AUDIT] Addresses are are duplicates
* [#30](https://github.com/iExecBlockchainComputing/PoCo/issues/30) : IexecHubInterface is not up to date
* [#31](https://github.com/iExecBlockchainComputing/PoCo/issues/31) : OwnableOZ event not correct
* [#32](https://github.com/iExecBlockchainComputing/PoCo/issues/32) : Need more gas
* [#33](https://github.com/iExecBlockchainComputing/PoCo/issues/33) : [CS AUDIT] Both a contract and an event are called WorkOrder.
* [#34](https://github.com/iExecBlockchainComputing/PoCo/issues/34) : [CS AUDIT] the variable names workerReward and workersReward are confusingly similar


### [v1.0.12](https://github.com/iExecBlockchainComputing/PoCo/releases/tag/v1.0.12)
Initial version. external audit launched on this release v1.0.12
