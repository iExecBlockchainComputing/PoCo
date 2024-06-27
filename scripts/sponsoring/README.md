# Add sponsoring functions to proxy

## Locally forked Bellecour network

0. Start node
```
LOCAL_FORK=true npx hardhat node --no-deploy
```

1. Deploy modules and add to proxy
```
(export LOCAL_FORK=true; \
npx hardhat run scripts/sponsoring/0_deploy-modules.ts --network external-hardhat && \
npx hardhat run scripts/sponsoring/1_add-modules-to-proxy.ts --network external-hardhat)
```
