
[![Build Status](https://drone.iex.ec//api/badges/iExecBlockchainComputing/PoCo/status.svg)](https://drone.iex.ec/iExecBlockchainComputing/PoCo)


#  Introduction to PoCo


[PoCo Series #1 — About Trust and Agents Incentives](https://medium.com/iex-ec/about-trust-and-agents-incentives-4651c138974c)

[PoCo Series #2 — On the use of staking to prevent attacks](https://medium.com/iex-ec/poco-series-2-on-the-use-of-staking-to-prevent-attacks-2a5c700558bd)

[PoCo Series #3 — PoCo protocole update](https://medium.com/iex-ec/poco-series-3-poco-protocole-update-a2c8f8f30126)


# PoCo UML


- [Contracts MCD](./uml/ContractV2.pdf)

- [Contracts and Actors Architecture](./uml/ArchitectureV2.pdf)

- [Nominal ask workflow sequence](./uml/nominalAskWorkflow.pdf)


# Actors :
- (w) = an account with a wallet key pair
- (s) = a smart contract created by (w)
- (p) = application to start ( like java prog) on the responsability of (w) when used
- (r) = a repository on the responsability of (w)

## Actor : Marketplace Creator :
create [IexecHub](./contracts/IexecHub.sol) smart contract. IexecHub is composed of [WorkerPoolHub](./contracts/WorkerPoolHub.sol),[DatasetHub](./contracts/DatasetHub.sol),[AppHub](./contracts/AppHub.sol),[Marketplace](./contracts/Marketplace.sol) Once IexecHub smart contract is created by Marketplace Creator, IexecHub and Marketplace can be used by the others actors scheduler, workers, iExecCloudUser :

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
            <td><a href="./test/00_base.js" target="_blank">0_base.js</a></td>
            <td></td>
            <td></td>
            <td>Marketplace Creator</td>
            <td>truffle cli</td>
            <td><a href="./contracts/IexecHub.sol" target="_blank">IexecHub</a>,
            <a href="./contracts/Marketplace.sol" target="_blank">Marketplace</a>,
            <a href="./contracts/WorkerPoolHub.sol" target="_blank">WorkerPoolHub</a>,
            <a href="./contracts/DatasetHub.sol" target="_blank">DatasetHub</a>,
            <a href="./contracts/AppHub.sol" target="_blank">AppHub</a>
            </td>
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
            <td><a href="./test/01_workerPoolCreation.js" target="_blank">01_workerPoolCreation.js</a></td>
            <td>createWorkerPool</td>
            <td>IexecHub</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler (cli web3j)</td>
            <td><a href="./contracts/WorkerPool.sol" target="_blank">WorkerPool</a></td>
        </tr>
        <tr>
            <td><a href="./test/04_createMarketOrderAsk.js" target="_blank">04_createMarketOrderAsk.js</a></td>
            <td>createMarketOrder</td>
            <td>WorkerPool</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./test/06_allowWorkerToContribute.js" target="_blank">06_allowWorkerToContribute.js</a></td>
            <td>allowWorkerToContribute</td>
            <td>WorkerPool</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./test/08_revealConsensus.js" target="_blank">08_revealConsensus.js</a></td>
            <td>revealConsensus</td>
            <td>WorkerPool</td>
            <td>ScheduleProvider</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td><a href="./test/10_finalizeWork.js" target="_blank">10_finalizeWork.js</a></td>
            <td>finalizeWork</td>
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
            <td><a href="./test/02_workerPoolSubscription.js" target="_blank">02_workerPoolSubscription.js</a></td>
            <td>subscribeToPool</td>
            <td>WorkerPool</td>
            <td>RessourceProvider</td>
            <td>iexec-worker</td>
        </tr>
        <tr>
            <td><a href="./test/07_workerContribute.js" target="_blank">07_workerContribute.js</a></td>
            <td>contribute</td>
            <td>WorkerPool</td>
            <td>RessourceProvider</td>
            <td>iexec-worker</td>
        </tr>
        <tr>
            <td><a href="./test/09_revealContribution.js" target="_blank">09_revealContribution.js</a></td>
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
            <td><a href="./test/03_appCreation.js" target="_blank">03_appCreation.js</a></td>
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


Optional: usage not yet implemented in V2

##  Ask Nominal Use Case :
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
            <td><a href="./test/04_createMarketOrderAsk.js" target="_blank">./test/04_createMarketOrderAsk.js</a></td>
            <td>createMarketOrder</td>
            <td>Marketplace</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>B + C - Market Matching+Trigger WorkOrder</td>
            <td><a href="./test/05_buyForWorkOrder.js" target="_blank">./test/05_buyForWorkOrder.js</a></td>
            <td>buyForWorkOrder</td>
            <td>IexecHub</td>
            <td>iExecCloudUser</td>
            <td><a href="./contracts/WorkOrder.sol" target="_blank">WorkOrder</a></td>
        </tr>
        <tr>
            <td>D - POCO</td>
            <td><a href="./test/06_allowWorkerToContribute.js" target="_blank">./test/06_allowWorkerToContribute.js</a></td>
            <td>allowWorkerToContribute</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>D - POCO</td>
            <td><a href="./test/07_workerContribute.js" target="_blank">./test/07_workerContribute.js</a></td>
            <td>contribute</td>
            <td>WorkerPool</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>D - POCO</td>
            <td><a href="./test/08_revealConsensus.js" target="_blank">./test/08_revealConsensus.js</a></td>
            <td>revealConsensus</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
        <tr>
            <td>D - POCO</td>
            <td><a href="./test/09_revealContribution.js" target="_blank">./test/09_revealContribution.js</a></td>
            <td>reveal</td>
            <td>WorkerPool</td>
            <td>iexec-worker</td>
            <td></td>
        </tr>
        <tr>
            <td>D - POCO</td>
            <td><a href="./test/10_finalizeWork.js" target="_blank">./test/10_finalizeWork.js</a></td>
            <td>finalizedWork</td>
            <td>WorkerPool</td>
            <td>iexec-scheduler</td>
            <td></td>
        </tr>
    </tbody>
</table>


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
            <td>ACTIVE</td>
            <td>acceptWorkOrder</td>
            <td>IexecHub</td>
            <td>scheduler</td>
            <td>WorkOrder accepted received by the scheduler</td>
        </tr>
        <tr>
            <td>REVEALING</td>
            <td>revealConsensus</td>
            <td>WorkOrderPool</td>
            <td>scheduler</td>
            <td>scheduler call revealConsensus. Workers can now call reveal function on WorkOrderPool </td>
        </tr>
        <tr>
            <td>CLAIMED</td>
            <td>claimFailedConsensus</td>
            <td>IexecHub</td>
            <td>iExecCloudUser</td>
            <td>if a WordeORder is in ACTIVE or REVEALING for too long, iExecCloudUser can get a refund by calling claimFailedConsensus</td>
        </tr>
        <tr>
            <td>COMPLETED</td>
            <td>finalizedWork</td>
            <td>WorkOrderPool</td>
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
            <td>allowWorkerToContribute</td>
            <td>WorkOrderPool</td>
            <td>scheduler</td>
            <td>Scheduler has commited to the WorkOrder (ACTIVE) and workers can contribute when called in.</td>
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
            <td>After scheduler has call revealConsensus, worker can call reveal function. If their revelation is correct. Contribution status is set to PROVED => POCO => ProofOfContribution </td>
        </tr>
        <tr>
            <td>REJECTED</td>
            <td>reopen</td>
            <td>WorkOrderPool</td>
            <td>scheduler</td>
            <td>If NO worker has revealed, scheduler call reopen function and all previous contribution are tag REJECTED  in order to reopen a new allowWorkerToContribute round</td>
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
./node_modules/.bin/truffle test test/00_base.js
```
### choice 1 or 2 then launch ALL tests :

```
./node_modules/.bin/truffle test
```

### choice 1 or 2 then launch nominal workflow tests :

```
./node_modules/.bin/truffle test test/*
```

### choice 1 or 2 then launch by contract/by fonctions tests :

```
./node_modules/.bin/truffle test test/"contract to test"/function to test"
```

## how to launch solidity-coverage analyse

```
npm run coverage
```
or
```
./node_modules/.bin/solidity-coverage
```


```
coverage : 11/06/2018

184 passing (10m)
1 pending

-----------------------------|----------|----------|----------|----------|----------------|
File                         |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
-----------------------------|----------|----------|----------|----------|----------------|
contracts/                  |      100 |     74.7 |      100 |      100 |                |
App.sol                    |      100 |       50 |      100 |      100 |                |
AppHub.sol                 |      100 |      100 |      100 |      100 |                |
Dataset.sol                |      100 |       50 |      100 |      100 |                |
DatasetHub.sol             |      100 |      100 |      100 |      100 |                |
IexecAPI.sol               |      100 |       50 |      100 |      100 |                |
IexecCallbackInterface.sol |      100 |      100 |      100 |      100 |                |
IexecHub.sol               |      100 |    70.54 |      100 |      100 |                |
IexecHubAccessor.sol       |      100 |       75 |      100 |      100 |                |
IexecHubInterface.sol      |      100 |      100 |      100 |      100 |                |
IexecLib.sol               |      100 |      100 |      100 |      100 |                |
Marketplace.sol            |      100 |    83.33 |      100 |      100 |                |
MarketplaceAccessor.sol    |      100 |       50 |      100 |      100 |                |
MarketplaceInterface.sol   |      100 |      100 |      100 |      100 |                |
OwnableOZ.sol              |      100 |    66.67 |      100 |      100 |                |
SafeMathOZ.sol             |      100 |       75 |      100 |      100 |                |
TestSha.sol                |      100 |      100 |      100 |      100 |                |
WorkOrder.sol              |      100 |    56.25 |      100 |      100 |                |
WorkerPool.sol             |      100 |     81.9 |      100 |      100 |                |
WorkerPoolHub.sol          |      100 |       75 |      100 |      100 |                |
-----------------------------|----------|----------|----------|----------|----------------|
All files                    |      100 |     74.7 |      100 |      100 |                |
-----------------------------|----------|----------|----------|----------|----------------|
```
## Oyente analyse see [here](./oyente)
