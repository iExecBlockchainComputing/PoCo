

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

### choice 1 or 2 then : it will deploy smart contracts according to the [2_deploy_contracts.js](./migrations/2_deploy_contracts) content.

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
