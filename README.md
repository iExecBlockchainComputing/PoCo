




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

WorkOrder status are :
- PENDING : workOrder not yet accepted by the scheduler of workerPool
- ACCEPTED : accepted by the scheduler of workerPool
- CANCELLED : a non accepted work order have been cancelled by the user U(w)
- ABORTED : an accepted work order has never reach the consensus and claimFailedConsensus has been called. The status is set to ABORTED
- COMPLETED : worker order is COMPLETED. finalizedWork function has been successfully called in the Workpool smart contract.


## Actor : Scheduler :
- ScheduleProvider = S(w)
- S(s) =  a [WorkerPool](./contracts/WorkerPool.sol) smart contract owned by S(w)
- S(p) = iexec-scheduler = application that schedule a worker pool activity  on the responsability of S(w). (works, tasks, datas for result in xtremweb)
- S(r) = ResultRepository = provide the work result for U(w) on the responsability of S(w)

Each WorkOrder affected in this WorkPool have a ConsensusStatus :
- PENDING : scheduler have not accepted the work order yet. (WorkOrder=PENDING)
- CANCELLED : a non accepted work order have been cancelled by the user U(w) (WorkOrder=CANCELLED)
- STARTED : scheduler has called acceptWorkOrder function.(WorkOrder=ACCEPTED)
- IN_PROGRESS :  scheduler has called at least on callForContribution (WorkOrder=ACCEPTED)
- REACHED :scheduler has called revealConsensus function (WorkOrder=ACCEPTED)
- FAILLED : claimFailedConsensus has been successfully called. (WorkOrder=ABORTED)
- FINALIZED :finalizedWork has been successfully called (WorkOrder=COMPLETED)


Each worker Contribution of an accepted WorkOrder has a WorkStatus :
- REQUESTED :  this worker has been callForContribution by the scheduler
- SUBMITTED : this worker has contribute
- POCO_ACCEPT : this worker has reveal and his contribution is valid
- REJECTED : this worker has reveal and his contribution is not valid



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
            <td><a href="./test/6_callForContributions.js" target="_blank">6_callForContributions.js</a></td>
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
## Nominal use case :
<table>
    <thead>
        <tr>
            <th>Sequence Diagram</th>
            <th>Truffle Test</th>
            <th>Fonction</th>
            <th align="center">on Contract</th>
            <th align="right">by Actor through program</th>
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
            <td><a href="./contracts/IexecHub.sol" target="_blank">IexecHub</a></td>
        </tr>
        <tr>
            <td></td>
            <td><a href="./test/1_workerPoolCreation.js" target="_blank">1_workerPoolCreation.js</a></td>
            <td>createWorkerPool</td>
            <td>IexecHub</td>
            <td>iexec-scheduler</td>
            <td><a href="./contracts/WorkerPool.sol" target="_blank">WorkerPool</a></td>
        </tr>
        <tr>
            <td></td>
            <td><a href="./test/2_workerPoolSubscription.js" target="_blank">2_workerPoolSubscription.js</a></td>
            <td>subscribeToPool</td>
            <td>IexecHub</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td></td>
            <td><a href="./test/3_appCreation.js" target="_blank">3_appCreation.js</a></td>
            <td>createApp</td>
            <td>IexecHub</td>
            <td>appProvider</td>
            <td><a href="./contracts/App.sol" target="_blank">App</a></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 4</a></td>
            <td><a href="./test/4_workOrderCreation.js" target="_blank">4_workOrderCreation.js</a></td>
            <td>createWorkOrder</td>
            <td>IexecHub</td>
            <td>iExecCloudUser (iexec-sdk)</td>
            <td><a href="./contracts/WorkOrder.sol" target="_blank">WorkOrder</a></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 5</a></td>
            <td><a href="./test/5_workOrderAccepted.js" target="_blank">5_workOrderAccepted.js</a></td>
            <td>acceptWorkOrder</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 6</a></td>
            <td><a href="./test/6_callForContributions.js" target="_blank">6_callForContributions.js</a></td>
            <td>callForContribution</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 7</a></td>
            <td><a href="./test/7_workerContribute.js" target="_blank">7_workerContribute.js</a></td>
            <td>contribute</td>
            <td>WorkerPool</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 8</a></td>
            <td><a href="./test/8_revealConsensus.js" target="_blank">8_revealConsensus.js</a></td>
            <td>revealConsensus</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 9</a></td>
            <td><a href="./test/9_revealContribution.js" target="_blank">9_revealContribution.js</a></td>
            <td>reveal</td>
            <td>WorkerPool</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 10</a></td>
            <td><a href="./test/10_finalizedWork.js" target="_blank">10_finalizedWork.js</a></td>
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
