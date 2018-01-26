





# Actors :
- (w) = an account with a wallet key pair
- (s) = a smart contract created by (w)
- (p) = application to start ( like java prog) on the responsability of (w) when used
- (r) = a repository on the responsability of (w)

## Marketplace Creator :
create [IexecHub](./contracts/IexecHub.sol) smart contract. IexecHub is composed of [ProvidersBalance](./contracts/ProvidersBalance.sol),[ProvidersScoring](./contracts/ProvidersScoring.sol),[TaskRequestHub](./contracts/TaskRequestHub.sol),[WorkerPoolHub](./contracts/WorkerPoolHub.sol),[DatasetHub](./contracts/DatasetHub.sol),[AppHub](./contracts/AppHub.sol). Once smart contract are created, Marketplace can be used by the following actors :

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





## Scheduler :
- ScheduleProvider = S(w)
- S(s) =  a [WorkerPool](./contracts/WorkerPool.sol) smart contract owned by S(w)
- S(p) = iexec-scheduler = application that schedule a worker pool activity  on the responsability of S(w). (works, tasks, datas for result in xtremweb)
- S(r) = ResultRepository = provide the task result for U(w) on the responsability of S(w)

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
            <td><a href="./test/5_taskRequestAccepted.js" target="_blank">5_taskRequestAccepted.js</a></td>
            <td>acceptTask</td>
            <td>IexecHub</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td><a href="./contracts/Contributions.sol" target="_blank">Contributions</a></td>
        </tr>
        <tr>
            <td><a href="./test/6_callForContributions.js" target="_blank">6_callForContributions.js</a></td>
            <td>callForContribution</td>
            <td>Contributions</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./test/8_revealConsensus.js" target="_blank">8_revealConsensus.js</a></td>
            <td>revealConsensus</td>
            <td>Contributions</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./test/10_finalizedTask.js" target="_blank">10_finalizedTask.js</a></td>
            <td>finalizedTask</td>
            <td>Contributions</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
    </tbody>
</table>



## Worker :
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
            <td>IexecHub</td>
            <td>RessourceProvider</td>
            <td>iexec-worker</td>
        </tr>
        <tr>
            <td><a href="./test/7_workerContribute.js" target="_blank">7_workerContribute.js</a></td>
            <td>contribute</td>
            <td>Contributions</td>
            <td>RessourceProvider</td>
            <td>iexec-worker</td>
        </tr>
        <tr>
            <td><a href="./test/9_revealContribution.js" target="_blank">9_revealContribution.js</a></td>
            <td>reveal</td>
            <td>Contributions</td>
            <td>RessourceProvider</td>
            <td>iexec-worker</td>
        </tr>
    </tbody>
</table>



## App Provider
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
            <td>?</td>
            <td><a href="./contracts/App.sol" target="_blank">App</a></td>
        </tr>
    </tbody>
</table>

## Dataset Provider
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
            <td><a href="./test/4_taskRequestCreation.js" target="_blank">4_taskRequestCreation.js</a></td>
            <td>createTaskRequest</td>
            <td>IexecHub</td>
            <td>iExecCloudUser (iexec-sdk)</td>
            <td><a href="./contracts/TaskRequest.sol" target="_blank">TaskRequest</a></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 5</a></td>
            <td><a href="./test/5_taskRequestAccepted.js" target="_blank">5_taskRequestAccepted.js</a></td>
            <td>acceptTask</td>
            <td>IexecHub</td>
            <td>iexec-scheduler</td>
            <td><a href="./contracts/Contributions.sol" target="_blank">Contributions</a></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 6</a></td>
            <td><a href="./test/6_callForContributions.js" target="_blank">6_callForContributions.js</a></td>
            <td>callForContribution</td>
            <td>Contributions</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 7</a></td>
            <td><a href="./test/7_workerContribute.js" target="_blank">7_workerContribute.js</a></td>
            <td>contribute</td>
            <td>Contributions</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 8</a></td>
            <td><a href="./test/8_revealConsensus.js" target="_blank">8_revealConsensus.js</a></td>
            <td>revealConsensus</td>
            <td>Contributions</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 9</a></td>
            <td><a href="./test/9_revealContribution.js" target="_blank">9_revealContribution.js</a></td>
            <td>reveal</td>
            <td>Contributions</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./uml/V2SequenceNominale.pdf" target="_blank">transaction 10</a></td>
            <td><a href="./test/10_finalizedTask.js" target="_blank">10_finalizedTask.js</a></td>
            <td>finalizedTask</td>
            <td>Contributions</td>
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
