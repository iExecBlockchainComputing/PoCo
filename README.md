
[![Build Status](https://drone.iex.ec//api/badges/iExecBlockchainComputing/PoCo/status.svg)](https://drone.iex.ec/iExecBlockchainComputing/PoCo)


#  WorkOrderStatusEnum
<table>
    <thead>
        <tr>
            <th>Status</th>
            <th>status after function call</th>
            <th>on contract</th>
            <th>by Actor</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>PENDING</td>
            <td>createWorkOrder</td>
            <td>IexecHub</td>
            <td>iExecCloudUser</td>
            <td>A WorkOrder has been created and not yet accepted by a scheduler.</td>
        </tr>
        <tr>
            <td>CANCELLED</td>
            <td>cancelWorkOrder</td>
            <td>IexecHub</td>
            <td>iExecCloudUser</td>
            <td>A WorkOrder, not yet accepted by a scheduler, can be cancelled by the creator of this WorkOrder</td>
        </tr>
        <tr>
            <td>ACCEPTED</td>
            <td>acceptWorkOrder</td>
            <td>IexecHub</td>
            <td>scheduler</td>
            <td>WorkOrder accepted by the scheduler (assigned to it if "any scheduler")</td>
        </tr>
        <tr>
            <td>REVEALING</td>
            <td>revealConsensus</td>
            <td>WorkOrderPool/td>
            <td>scheduler</td>
            <td>scheduler call revealConsensus. Workers can now call reveal function on WorkOrderPool </td>
        </tr>
        <tr>
            <td>CLAIMED</td>
            <td>claimFailedConsensus</td>
            <td>IexecHub/td>
            <td>iExecCloudUser or any ?</td>
            <td>if a WordeORder is in ACCEPTED or REVEALING for too long, iExecCloudUser can get a refund by calling claimFailedConsensus</td>
        </tr>
        <tr>
            <td>COMPLETED</td>
            <td>finalizedWork</td>
            <td>WorkOrderPool/td>
            <td>scheduler</td>
            <td>Consensus reached, at least one worker has reveal and reveal period ended or all workers (with positive contributions) have revealed, scheduler can call finalizedWork function. This call distributeRewards and set result and status in WorkOrder</td>
        </tr>
    </tbody>
</table>

#  ContributionStatusEnum
<table>
    <thead>
        <tr>
            <th>Status</th>
            <th>status after function call</th>
            <th>on contract</th>
            <th>by Actor</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>AUTHORIZED</td>
            <td>callForContribution</td>
            <td>WorkOrderPool</td>
            <td>scheduler</td>
            <td>Scheduler has commited to the WorkOrder (ACCEPTED) and workers can contribute when called in.</td>
        </tr>
        <tr>
            <td>CONTRIBUTED</td>
            <td>contribute</td>
            <td>WorkOrderPool</td>
            <td>worker</td>
            <td>A Worker has contribute to a WorkOrder. his resultHash, resultSign are stored. his stake is locked too</td>
        </tr>
        <tr>
            <td>PROVED</td>
            <td>reveal</td>
            <td>WorkOrderPool</td>
            <td>worker</td>
            <td>After scheduler has call revealConsensus, worker can call reveal function. If their revalation is correct. Contribution status is set to PROVED => POCO => ProofOfContribution </td>
        </tr>
        <tr>
            <td>REJECTED</td>
            <td>reopen</td>
            <td>WorkOrderPool</td>
            <td>scheduler</td>
            <td>If NO worker has revealed, scheduler call reopen function and all previous contribution are tag REJECTED  in order to reopen a new callForContribution round</td>
        </tr>
    </tbody>
</table>


# Actors :
- (w) = an account with a wallet key pair
- (s) = a smart contract created by (w)
- (p) = application to start ( like java prog) on the responsability of (w) when used
- (r) = a repository on the responsability of (w)

## Actor : Marketplace Creator :
create [IexecHub](./contracts/IexecHub.sol) smart contract. IexecHub is composed of [WorkOrderHub](./contracts/WorkOrderHub.sol),[WorkerPoolHub](./contracts/WorkerPoolHub.sol),[DatasetHub](./contracts/DatasetHub.sol),[AppHub](./contracts/AppHub.sol). Once IexecHub smart contract is created by Marketplace Creator, Marketplace can be used by the others actors scheduler, workers, iExecCloudUser :

blockchain interaction :
<table>
    <thead>
        <tr>
            <th>Sequence Diagram</th>
            <th>Truffle Test</th>
            <th>Fonction</th>
            <th align="center">on Contract</th>
            <th align="right">by Actor</th>
            <th align="right">through Program</th>
            <th align="center">Contract created</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td></td>
            <td><a href="./test/0_base.js" target="_blank">0_base.js</a></td>
            <td></td>
            <td></td>
            <td>Marketplace Creator</td>
            <td>truffle cli</td>
            <td><a href="./contracts/IexecHub.sol" target="_blank">IexecHub</a></td>
        </tr>
    </tbody>
</table>

## Actor : iExecCloudUser
- iExecCloudUser = U(w)
- U(s) =  a [WorkOrder](./contracts/WorkOrder.sol) smart contract owned by U(w)


## Actor : Scheduler :
- ScheduleProvider = S(w)
- S(s) =  a [WorkerPool](./contracts/WorkerPool.sol) smart contract owned by S(w)
- S(p) = iexec-scheduler = application that schedule a worker pool activity  on the responsability of S(w). (works, tasks, datas for result in xtremweb)
- S(r) = ResultRepository = provide the work result for U(w) on the responsability of S(w)



blockchain interaction :

<table>
    <thead>
        <tr>
            <th>Truffle Test</th>
            <th>Fonction</th>
            <th align="center">on Contract</th>
            <th align="right">by Actor</th>
            <th align="right">through Program</th>
            <th align="center">Contract created</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><a href="./test/1_workerPoolCreation.js" target="_blank">1_workerPoolCreation.js</a></td>
            <td>createWorkerPool</td>
            <td>IexecHub</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler (cli web3j)</td>
            <td><a href="./contracts/WorkerPool.sol" target="_blank">WorkerPool</a></td>
        </tr>
        <tr>
            <td><a href="./test/5_workOrderAccepted.js" target="_blank">5_workOrderAccepted.js</a></td>
            <td>acceptWorkOrder</td>
            <td>WorkerPool</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./test/6_callForContribution.js" target="_blank">6_callForContribution.js</a></td>
            <td>callForContribution</td>
            <td>WorkerPool</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./test/8_revealConsensus.js" target="_blank">8_revealConsensus.js</a></td>
            <td>revealConsensus</td>
            <td>WorkerPool</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./test/10_finalizedWork.js" target="_blank">10_finalizedWork.js</a></td>
            <td>finalizedWork</td>
            <td>WorkerPool</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
    </tbody>
</table>



## Actor : Worker :
- W(w) = RessourceProvider =  RessourceProvider wallet
- W(p) = iexec-worker = xtremweb worker application today

blockchain interaction :
<table>
    <thead>
        <tr>
            <th>Truffle Test</th>
            <th>Fonction</th>
            <th align="center">on Contract</th>
            <th align="right">by Actor</th>
            <th align="right">through Program</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><a href="./test/2_workerPoolSubscription.js" target="_blank">2_workerPoolSubscription.js</a></td>
            <td>subscribeToPool</td>
            <td>WorkerPool</td>
            <td>RessourceProvider</td>
            <td>iexec-worker</td>
        </tr>
        <tr>
            <td><a href="./test/7_workerContribute.js" target="_blank">7_workerContribute.js</a></td>
            <td>contribute</td>
            <td>WorkerPool</td>
            <td>RessourceProvider</td>
            <td>iexec-worker</td>
        </tr>
        <tr>
            <td><a href="./test/9_revealContribution.js" target="_blank">9_revealContribution.js</a></td>
            <td>reveal</td>
            <td>WorkerPool</td>
            <td>RessourceProvider</td>
            <td>iexec-worker</td>
        </tr>
    </tbody>
</table>



## Actor : App Provider
- A(w) = AppProvider = app Provider wallet
- A(s) = [App](./contracts/App.sol) = app smart contract created by A(w) with the app characteristics
- A(r) = AppRepository = provide app reference on the responsability of A(w). . (apps, datas for apps in xtremweb, docker hub for docker app etc ... ) for W(p) usage

blockchain interaction :
<table>
    <thead>
        <tr>
            <th>Sequence Diagram</th>
            <th>Truffle Test</th>
            <th>Fonction</th>
            <th align="center">on Contract</th>
            <th align="right">by Actor</th>
            <th align="right">through Program</th>
            <th align="center">Contract created</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td></td>
            <td><a href="./test/3_appCreation.js" target="_blank">3_appCreation.js</a></td>
            <td>createApp</td>
            <td>IexecHub</td>
            <td>appProvider</td>
            <td>iexec-sdk</td>
            <td><a href="./contracts/App.sol" target="_blank">App</a></td>
        </tr>
    </tbody>
</table>

## Actor : Dataset Provider
- D(w) = DatasetProvider = dataset Provider wallet
- D(s) = [Dataset](./contracts/Dataset.sol) = app smart contract created by D(w) with the dataset characteristics
- D(r) = DatasetRepository = provide dataset reference on the responsability of D(w) for W(p) usage

blockchain interaction :
TODO
## Optimized Ask Use Case :
<table>
    <thead>
        <tr>
            <th>Phase</th>
            <th>Truffle Test</th>
            <th>Fonction</th>
            <th align="center">on Contract</th>
            <th align="right">by Actor through program</th>
            <th align="center">Contract created</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>A - Initialization Markeplace</td>
            <td><a href="./test/00_base.js" target="_blank">./test/00_base.js</a></td>
            <td></td>
            <td></td>
            <td>Marketplace Creator</td>
            <td><a href="./contracts/IexecHub.sol" target="_blank">IexecHub</a>,<a href="./contracts/Marketplace.sol" target="_blank">Marketplace</a></td>
        </tr>
        <tr>
            <td>A - Initialization WorkerPool</td>
            <td><a href="./test/01_workerPoolCreation.js" target="_blank">./test/01_workerPoolCreation.js</a></td>
            <td>createWorkerPool</td>
            <td>IexecHub</td>
            <td>iexec-scheduler</td>
            <td><a href="./contracts/WorkerPool.sol" target="_blank">WorkerPool</a></td>
        </tr>
        <tr>
            <td>A - Initialization Worker in WorkerPool</td>
            <td><a href="./test/02_workerPoolSubscription.js" target="_blank">./test/02_workerPoolSubscription.js</a></td>
            <td>subscribeToPool</td>
            <td>IexecHub</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>A - Initialization App</td>
            <td><a href="./test/03_appCreation.js" target="_blank">./test/03_appCreation.js</a></td>
            <td>createApp</td>
            <td>IexecHub</td>
            <td>appProvider</td>
            <td><a href="./contracts/App.sol" target="_blank">App</a></td>
        </tr>
        <tr>
            <td>B - Market Matching</td>
            <td><a href="./test/ask/04_emitMarketOrderAsk.js" target="_blank">./test/ask/04_emitMarketOrderAsk.js</a></td>
            <td>emitMarketOrder</td>
            <td>Marketplace</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>B + C - Market Matching+Trigger WorkOrder</td>
            <td><a href="./test/ask/05_answerAndemitWorkOrder.js" target="_blank">./test/ask/05_answerAndemitWorkOrder.js</a></td>
            <td>answerEmitWorkOrder</td>
            <td>IexecHub</td>
            <td>iExecCloudUser</td>
            <td><a href="./contracts/WorkOrder.sol" target="_blank">WorkOrder</a></td>
        </tr>
        <tr>
            <td>D - POCO</td>
            <td><a href="./test/ask/06_callForContribution.js" target="_blank">./test/ask/06_callForContribution.js</a></td>
            <td>callForContribution</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>D - POCO</td>
            <td><a href="./test/ask/07_workerContribute.js" target="_blank">./test/ask/07_workerContribute.js</a></td>
            <td>contribute</td>
            <td>WorkerPool</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>D - POCO</td>
            <td><a href="./test/ask/08_revealConsensus.js" target="_blank">./test/ask/08_revealConsensus.js</a></td>
            <td>revealConsensus</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>D - POCO</td>
            <td><a href="./test/ask/09_revealContribution.js" target="_blank">./test/ask/09_revealContribution.js</a></td>
            <td>reveal</td>
            <td>WorkerPool</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>D - POCO</td>
            <td><a href="./test/ask/10_finalizedWork.js" target="_blank">./test/ask/0_finalizedWork.js</a></td>
            <td>finalizedWork</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
    </tbody>
</table>

## Ask Use Case :
<table>
    <thead>
        <tr>
            <th>Phase</th>
            <th>Truffle Test</th>
            <th>Fonction</th>
            <th align="center">on Contract</th>
            <th align="right">by Actor through program</th>
            <th align="center">Contract created</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>A - Initialization Markeplace</td>
            <td><a href="./test/00_base.js" target="_blank">./test/00_base.js</a></td>
            <td></td>
            <td></td>
            <td>Marketplace Creator</td>
            <td><a href="./contracts/IexecHub.sol" target="_blank">IexecHub</a>,<a href="./contracts/Marketplace.sol" target="_blank">Marketplace</a></td>
        </tr>
        <tr>
            <td>A - Initialization WorkerPool</td>
            <td><a href="./test/01_workerPoolCreation.js" target="_blank">./test/01_workerPoolCreation.js</a></td>
            <td>createWorkerPool</td>
            <td>IexecHub</td>
            <td>iexec-scheduler</td>
            <td><a href="./contracts/WorkerPool.sol" target="_blank">WorkerPool</a></td>
        </tr>
        <tr>
            <td>A - Initialization Worker in WorkerPool</td>
            <td><a href="./test/02_workerPoolSubscription.js" target="_blank">./test/02_workerPoolSubscription.js</a></td>
            <td>subscribeToPool</td>
            <td>IexecHub</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>A - Initialization App</td>
            <td><a href="./test/03_appCreation.js" target="_blank">./test/03_appCreation.js</a></td>
            <td>createApp</td>
            <td>IexecHub</td>
            <td>appProvider</td>
            <td><a href="./contracts/App.sol" target="_blank">App</a></td>
        </tr>
        <tr>
            <td>B - Market Matching</td>
            <td><a href="./test/ask/04_emitMarketOrderAsk.js" target="_blank">./test/ask/04_emitMarketOrderAsk.js</a></td>
            <td>emitMarketOrder</td>
            <td>Marketplace</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>B - Market Matching</td>
            <td><a href="./test/ask/answerThenEmit/05_answerAskOrder.js" target="_blank">./test/ask/answerThenEmit/05_answerAskOrder.js</a></td>
            <td>answerAskOrder</td>
            <td>Marketplace</td>
            <td>iExecCloudUser</td>
            <td></td>
        </tr>
        <tr>
            <td>C - Trigger WorkOrder</td>
            <td><a href="./test/ask/answerThenEmit/06_emitWorkOrder.js" target="_blank">./test/ask/answerThenEmit/06_emitWorkOrder.js</a></td>
            <td>consumeEmitWorkOrder</td>
            <td>IexecHub</td>
            <td>iExecCloudUser</td>
            <td><a href="./contracts/WorkOrder.sol" target="_blank">WorkOrder</a></td>
        </tr>
        <tr>
            <td>C - POCO</td>
            <td><a href="./test/ask/answerThenEmit/07_callForContribution.js" target="_blank">./test/ask/answerThenEmit/07_callForContribution.js</a></td>
            <td>callForContribution</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>C - POCO</td>
            <td><a href="./test/ask/answerThenEmit/08_workerContribute.js" target="_blank">./test/ask/answerThenEmit/08_workerContribute.js</a></td>
            <td>contribute</td>
            <td>WorkerPool</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>C - POCO</td>
            <td><a href="./test/ask/answerThenEmit/09_revealConsensus.js" target="_blank">./test/ask/answerThenEmit/09_revealConsensus.js</a></td>
            <td>revealConsensus</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>C - POCO</td>
            <td><a href="./test/ask/answerThenEmit/10_revealContribution.js" target="_blank">./test/ask/answerThenEmit/10_revealContribution.js</a></td>
            <td>reveal</td>
            <td>WorkerPool</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>C - POCO</td>
            <td><a href="./test/ask/answerThenEmit/11_finalizedWork.js" target="_blank">./test/ask/answerThenEmit/11_finalizedWork.js</a></td>
            <td>finalizedWork</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
    </tbody>
</table>


## Bid Use Case :
<table>
    <thead>
        <tr>
            <th>Phase</th>
            <th>Truffle Test</th>
            <th>Fonction</th>
            <th align="center">on Contract</th>
            <th align="right">by Actor through program</th>
            <th align="center">Contract created</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>A - Initialization Markeplace</td>
            <td><a href="./test/00_base.js" target="_blank">./test/00_base.js</a></td>
            <td></td>
            <td></td>
            <td>Marketplace Creator</td>
            <td><a href="./contracts/IexecHub.sol" target="_blank">IexecHub</a>,<a href="./contracts/Marketplace.sol" target="_blank">Marketplace</a></td>
        </tr>
        <tr>
            <td>A - Initialization WorkerPool</td>
            <td><a href="./test/01_workerPoolCreation.js" target="_blank">./test/01_workerPoolCreation.js</a></td>
            <td>createWorkerPool</td>
            <td>IexecHub</td>
            <td>iexec-scheduler</td>
            <td><a href="./contracts/WorkerPool.sol" target="_blank">WorkerPool</a></td>
        </tr>
        <tr>
            <td>A - Initialization Worker in WorkerPool</td>
            <td><a href="./test/02_workerPoolSubscription.js" target="_blank">./test/02_workerPoolSubscription.js</a></td>
            <td>subscribeToPool</td>
            <td>IexecHub</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>A - Initialization App</td>
            <td><a href="./test/03_appCreation.js" target="_blank">./test/03_appCreation.js</a></td>
            <td>createApp</td>
            <td>IexecHub</td>
            <td>appProvider</td>
            <td><a href="./contracts/App.sol" target="_blank">App</a></td>
        </tr>
        <tr>
            <td>B - Market Matching</td>
            <td><a href="./test/bid/04_emitMarketOrderBid.js" target="_blank">./test/bid/04_emitMarketOrderBid.js</a></td>
            <td>emitMarketOrder</td>
            <td>Marketplace</td>
            <td>iExecCloudUser</td>
            <td></td>
        </tr>
        <tr>
            <td>B - Market Matching</td>
            <td><a href="./test/bid/05_answerBidOrder.js" target="_blank">./test/bid/05_answerBidOrder.js</a></td>
            <td>answerBidOrder</td>
            <td>Marketplace</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>C - Trigger WorkOrder</td>
            <td><a href="./test/bid/06_emitWorkOrder.js" target="_blank">./test/bid/06_emitWorkOrder.js</a></td>
            <td>consumeEmitWorkOrder</td>
            <td>IexecHub</td>
            <td>iExecCloudUser</td>
            <td><a href="./contracts/WorkOrder.sol" target="_blank">WorkOrder</a></td>
        </tr>
        <tr>
            <td>C - POCO</td>
            <td><a href="./test/bid/07_callForContribution.js" target="_blank">./test/bid/07_callForContribution.js</a></td>
            <td>callForContribution</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>C - POCO</td>
            <td><a href="./test/bid/08_workerContribute.js" target="_blank">./test/bid/08_workerContribute.js</a></td>
            <td>contribute</td>
            <td>WorkerPool</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>C - POCO</td>
            <td><a href="./test/bid/09_revealConsensus.js" target="_blank">./test/bid/09_revealConsensus.js</a></td>
            <td>revealConsensus</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>C - POCO</td>
            <td><a href="./test/bid/10_revealContribution.js" target="_blank">./test/bid/10_revealContribution.js</a></td>
            <td>reveal</td>
            <td>WorkerPool</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>C - POCO</td>
            <td><a href="./test/bid/11_finalizedWork.js" target="_blank">./test/bid/11_finalizedWork.js</a></td>
            <td>finalizedWork</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
    </tbody>
</table>


# how to build

```
npm install
./node_modules/.bin/truffle compile
```

# how to migrate  

### choice 1 :prepare ethereumjs simu
Install the latest testrpc
```
npm install -g ethereumjs-testrpc

```
start your testrpc with
```
testrpc
```
You must see somting like this atb the end of the log

```
Listening on localhost:8545
```


### choice 2 : prepare Local geth node

Pull the the following docker image
```
docker pull iexechub/iexec-geth-local
```
start container
```
docker run -d --name iexec-geth-local --entrypoint=./startupGeth.sh -p 8545:8545 iexechub/iexec-geth-local
```
wait to see in logs the word : LOCAL_GETH_WELL_INITIALIZED :
```
docker logs -f iexec-geth-local
```
Your local geth network  is ready, you can launch your truffle action

### choice 1 or 2 then : it will deploy smart contracts according to the [2_deploy_contracts.js](./migrations/2_deploy_contracts.js) content.

```
./node_modules/.bin/truffle migrate
```

# how to test

### choice 1 or 2 then launch one test :

```
./node_modules/.bin/truffle test test/base.js
```
### choice 1 or 2 then launch ALL tests :

```
./node_modules/.bin/truffle test
```

# how to launch solidity-coverage analyse

```
npm run coverage
```
or
```
./node_modules/.bin/solidity-coverage
```


```
coverage : 21/03/2018
---------------------------|----------|----------|----------|----------|----------------|
File                       |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
---------------------------|----------|----------|----------|----------|----------------|
 contracts/                |    70.64 |    36.16 |    69.01 |    70.77 |                |
  App.sol                  |      100 |       50 |      100 |      100 |                |
  AppHub.sol               |      100 |      100 |      100 |      100 |                |
  AuthorizedList.sol       |    42.86 |      100 |    42.86 |    42.86 |... 72,74,80,82 |
  Closable.sol             |    27.27 |        0 |       50 |    27.27 |... 34,35,36,37 |
  Dataset.sol              |    72.73 |       50 |       25 |    78.57 |       55,59,63 |
  DatasetHub.sol           |      100 |      100 |      100 |      100 |                |
  IexecAPI.sol             |        0 |        0 |        0 |        0 |... 30,43,44,45 |
  IexecHub.sol             |    67.57 |    34.93 |     72.5 |    67.35 |... 582,583,584 |
  IexecHubAccessor.sol     |      100 |       50 |      100 |      100 |                |
  IexecHubInterface.sol    |      100 |      100 |      100 |      100 |                |
  IexecLib.sol             |      100 |      100 |      100 |      100 |                |
  Marketplace.sol          |    73.68 |    36.36 |       75 |    74.36 |... 114,115,244 |
  MarketplaceAccessor.sol  |       75 |       25 |       50 |       60 |          12,13 |
  MarketplaceInterface.sol |      100 |      100 |      100 |      100 |                |
  OwnableOZ.sol            |      100 |       75 |      100 |      100 |                |
  SafeMathOZ.sol           |     87.5 |     62.5 |    77.78 |    88.24 |          46,51 |
  TestSha.sol              |      100 |      100 |      100 |      100 |                |
  WorkOrder.sol            |    75.86 |    27.78 |    57.14 |    75.86 |... 2,97,98,111 |
  WorkerPool.sol           |       68 |    35.11 |       50 |    68.26 |... 374,423,443 |
  WorkerPoolHub.sol        |    88.89 |       50 |    88.89 |    84.21 |       97,98,99 |
---------------------------|----------|----------|----------|----------|----------------|
All files                  |    70.64 |    36.16 |    69.01 |    70.77 |                |
---------------------------|----------|----------|----------|----------|----------------|
```
