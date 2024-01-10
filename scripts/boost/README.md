# Add Boost functions to proxy

## Locally forked Bellecour network

0. Start node
```
LOCAL_FORK=true npx hardhat node --no-deploy
```

1. Deploy modules and add to proxy
```
LOCAL_FORK=true; \
npx hardhat run scripts/boost/0_deploy-modules.ts --network external-hardhat && \
npx hardhat run scripts/boost/1_add-modules-to-proxy.ts --network external-hardhat
```

For later production deployment, either
A. Get transaction data from previous logs
OR
B. Re-generate it with CLI
```
node ../erc1538upgrade-cli/src/erc1538update.js
```
```
node ../erc1538upgrade-cli/src/timelock.js
```

## Bellecour network

1a. Deploy modules

1b. Schedule update
```
const tx = await timeLockAdmin
    .sendTransaction({
        to: timeLockAddress,
        value: 0,
        data: '<schedule-data>',
    })
    .then((x) => x.wait());
```
1c. Execute update
```
const tx = await timeLockAdmin
    .sendTransaction({
        to: timeLockAddress,
        value: 0,
        data: '<execute-data>',
    })
    .then((x) => x.wait());
```