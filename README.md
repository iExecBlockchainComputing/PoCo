
[![Build Status](https://drone.iex.ec//api/badges/iExecBlockchainComputing/PoCo/status.svg)](https://drone.iex.ec/iExecBlockchainComputing/PoCo)


#  Introduction to PoCo

[PoCo Series #1 — About Trust and Agents Incentives](https://medium.com/iex-ec/about-trust-and-agents-incentives-4651c138974c)

[PoCo Series #2 — On the use of staking to prevent attacks](https://medium.com/iex-ec/poco-series-2-on-the-use-of-staking-to-prevent-attacks-2a5c700558bd)

[PoCo Series #3 — PoCo protocole update](https://medium.com/iex-ec/poco-series-3-poco-protocole-update-a2c8f8f30126)

[PoCo Series #4 — Enclaves and Trusted Executions](https://medium.com/iex-ec/poco-series-4-sgx-enclaves-and-trusted-executions-6f2ebed8d4fa)

[PoCo Series #5 — Open decentralized brokering on the iExec platform](https://medium.com/iex-ec/poco-series-5-open-decentralized-brokering-on-the-iexec-platform-67b266e330d8)

# PoCo UML

- [Contracts and Actors Architecture](./uml/architecture-ODB.png)

- [Nominal workflow sequence](./uml/nominalworkflow-ODB.png)

- [Nominal workflow sequence w/ TEE](./uml/nominalworkflow-ODB+TEE.png)


# Documentation

- [Full PoCo documentaion](https://docs.iex.ec/poco.html)

# how to build

```
npm install
./node_modules/.bin/truffle compile
```

# how to migrate  

### choice 1 :prepare ethereumjs simu

start ganache with
```
./ganache-custom
```
You must see someting like this at the end of the log

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
./node_modules/.bin/truffle test test/000_fullchain.js
```
### choice 1 or 2 then launch ALL tests :

```
./node_modules/.bin/truffle test
```
