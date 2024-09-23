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

2. Run test(s)
```
LOCAL_FORK=true npx hardhat test test/byContract/IexecPoco/04_finalize.test.ts --network external-hardhat
```

OR

0. Run test(s) directly (without launching node and deploying/upgrading Poco manually)
```
LOCAL_FORK=true HANDLE_SPONSORING_UPGRADE_INTERNALLY=true npx hardhat test test/byContract/IexecPoco/04_finalize.test.ts
```