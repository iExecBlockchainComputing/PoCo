





# Actors :
- (w) = an account with a wallet key pair
- (s) = a smart contract created by (w)
- (p) = application to start ( like java prog) on the responsability of (w) when used
- (r) = a repository on the responsability of (w)

## Marketplace Creator :
create [IexecHub](./contracts/IexecHub.sol) smart contract. IexecHub is composed of [ProvidersBalance](./contracts/ProvidersBalance.sol),[ProvidersScoring](./contracts/ProvidersScoring.sol),[TaskRequestHub](./contracts/TaskRequestHub.sol),[WorkerPoolHub](./contracts/WorkerPoolHub.sol),[DatasetHub](./contracts/DatasetHub.sol),[AppHub](./contracts/AppHub.sol). Once smart contract are created, Marketplace can be used by the following actors :

## Scheduler :
- Scheduler = S(w)
- S(s) =  a [WorkerPool](./contracts/WorkerPool.sol) smart contract owned by S(w)
- S(p) = Dispatcher = application that schedule a worker pool activity  on the responsability of S(w). (works, tasks, datas for result in xtremweb)
- S(r) = ResultRepository = provide the task result for U(w) on the responsability of S(w)

## Worker :
- W(w) = RessourceProvider =  RessourceProvider wallet
- W(p) = Worker = xtremweb worker application today

## App Provider
- A(w) = AppProvider = app Provider wallet
- A(s) = [App](./contracts/App.sol) = app smart contract created by A(w) with the app characteristics
- A(r) = AppRepository = provide app reference on the responsability of A(w). . (apps, datas for apps in xtremweb, docker hub for docker app etc ... ) for W(p) usage


## Dataset Provider
- D(w) = DatasetProvider = dataset Provider wallet
- D(s) = [Dataset](./contracts/Dataset.sol) = app smart contract created by D(w) with the dataset characteristics
- D(r) = DatasetRepository = provide dataset reference on the responsability of D(w) for W(p) usage

## Nominal use case :
<table>
    <thead>
        <tr>
            <th>Test</th>
            <th>Fonction</th>
            <th align="center">on Contract</th>
            <th align="right">by Actor</th>
            <th align="center">Contract created</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><a href="./test/0_base.js" target="_blank">0_base.js</a></td>
            <td></td>
            <td></td>
            <td>Marketplace Creator</td>
            <td>[IexecHub](./contracts/IexecHub.sol) </td>
        </tr>
        <tr>
            <td>[1_workerPoolCreation.js](./test/1_workerPoolCreation.js)</td>
            <td>createWorkerPool</td>
            <td>IexecHub</td>
            <td>scheduler</td>
            <td>[WorkerPool](./contracts/WorkerPool.sol)</td>
        </tr>
        <tr>
            <td>[2_workerPoolSubscription.js](./test/2_workerPoolSubscription.js)</td>
            <td>subscribeToPool</td>
            <td>IexecHub</td>
            <td>worker</td>
            <td></td>
        </tr>
        <tr>
        <td>[3_appCreation.js](./test/3_appCreation.js)</td>
            <td>createApp</td>
            <td>IexecHub</td>
            <td>appProvider</td>
            <td>[App](./contracts/App.sol)</td>
        </tr>
        <tr>
        <td>[4_taskRequestCreation.js](./test/4_taskRequestCreation.js)</td>
            <td>createTaskRequest</td>
            <td>IexecHub</td>
            <td>iExecCloudUser</td>
            <td>[TaskRequest](./contracts/TaskRequest.sol)</td>
        </tr>
        <tr>
        <td>[5_taskRequestAccepted.js](./test/5_taskRequestAccepted.js)</td>
            <td>acceptTask</td>
            <td>IexecHub</td>
            <td>scheduler</td>
            <td>[Contributions](./contracts/Contributions.sol)</td>
        </tr>
        <tr>
        <td>[6_callForContributions.js](./test/6_callForContributions.js)</td>
            <td>callForContribution</td>
            <td>Contributions</td>
            <td>scheduler</td>
            <td></td>
        </tr>
        <tr>
        <td>[7_workerContribute.js](./test/7_workerContribute.js)</td>
            <td>contribute</td>
            <td>Contributions</td>
            <td>worker</td>
            <td></td>
        </tr>
        <tr>
        <td>[8_revealConsensus.js](./test/8_revealConsensus.js)</td>
            <td>revealConsensus</td>
            <td>Contributions</td>
            <td>scheduler</td>
            <td></td>
        </tr>
        <tr>
        <td>[9_revealContribution.js](./test/9_revealContribution.js)</td>
            <td>reveal</td>
            <td>Contributions</td>
            <td>worker</td>
            <td></td>
        </tr>
        <tr>
        <td>[10_finalizedTask.js](./test/10_finalizedTask.js)</td>
            <td>finalizedTask</td>
            <td>Contributions</td>
            <td>scheduler</td>
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
