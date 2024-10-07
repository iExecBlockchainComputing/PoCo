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


## Bellecour

0. Deploy modules
```
npx hardhat run scripts/sponsoring/0_deploy-modules.ts --network bellecour
```

```
Deploying modules..
Deployer: 0x0B3a38b0A47aB0c5E8b208A703de366751Df5916
IexecOrderManagementDelegate: 0xDF63F026779E31AcD1DB4626b39Ea5148f7B9AA4 // https://blockscout.bellecour.iex.ec/tx/0x072d8d4e392bc67367e7434a88ac063c876973edee5637568d9c8462f8eec552
IexecPoco1Delegate: 0x1eE1cceF893DF6c4D3FC4eCaF315F09183f3048c // https://blockscout.bellecour.iex.ec/tx/0xc975f4c94fba7a19573d6094aff9178a21d07e3f2e13c8944a0bcb62f62cb6a8
IexecPoco2Delegate: 0x7eCf076343FBe296Da2D39f20B2a01AaBB68CC27 // https://blockscout-bellecour.iex.ec/tx/0x4013dcc930acc2ac5fa53f4ad1062e4b6bd0deb6945972534b2db3586a6617d1
IexecPocoAccessorsDelegate: 0xa1d371eF7bf36e89Db41276543ACf91Ec50Dd261 // https://blockscout-bellecour.iex.ec/tx/0xcc90f94b6ddb809720f94271b7b58bef9b24c4fe6e92a72f1271c5f83912081f
```

0b. Verify contracts

- Blockscout v5
```
BLOCKSCOUT_VERSION=v5 npx hardhat run ./scripts/sponsoring/verify.ts --network bellecour
```

- Blockscout v6

Contracts have been verified using `etherscan-verify` plugin of `hardhat-deploy` (v0.12.4):
```
npx hardhat --network bellecour etherscan-verify
```
and embedded `hardhat-verify` plugin of `hardhat` (v2.22.12):
```
npx hardhat run ./scripts/sponsoring/verify.ts --network bellecour
```
by previously modifiying the `.json` file produced by:
```
await deployments.deploy('<XxxxDelegate>Delegate', {
    from: deployer.address,
    libraries: {
        IexecLibOrders_v5: deploymentOptions.IexecLibOrders_v5
    }
}
```

1. Schedule upgrade

From [c54f713](https://github.com/iExecBlockchainComputing/PoCo/blob/c54f713af4a520ed3260bf119e689cf32cf85925/scripts/sponsoring/1_add-modules-to-proxy.ts) commit:
```
npx hardhat run scripts/sponsoring/1_add-modules-to-proxy.ts --network bellecour
```
- Tx: https://blockscout-bellecour.iex.ec/tx/0x59c94a0206187ff9cfe36bf380dfa012f25b51189e321ed70650827230ab8bd7


1. Execute upgrade

From [1c5d486](https://github.com/iExecBlockchainComputing/PoCo/blob/1c5d486a90e14b8f1e5df96d90926861f103d6ea/scripts/sponsoring/1_add-modules-to-proxy.ts) commit:
```
npx hardhat run scripts/sponsoring/1_add-modules-to-proxy.ts --network bellecour
```
