# Add sponsoring functions to proxy

## Currently pointing modules that will be modified

| Contract                                                                                                                                                              | Address                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [IexecOrderManagementDelegate](https://github.com/iExecBlockchainComputing/PoCo/blob/v5/contracts/modules/delegates/IexecOrderManagementDelegate.sol)                 | [0xc7d6c9cAf4cdA7B1EC24bd83873A822eE7Da2966](https://blockscout-bellecour.iex.ec/address/0xc7d6c9cAf4cdA7B1EC24bd83873A822eE7Da2966) |
| [IexecPocoDelegate](https://github.com/iExecBlockchainComputing/PoCo/blob/153974edcde0c9bd98dab3db77a42e27f07117b2/contracts/modules/delegates/IexecPocoDelegate.sol) | [0xE20a3d2B778B9e924c68dD74beB6723620eBaD0c](https://blockscout-bellecour.iex.ec/address/0xE20a3d2B778B9e924c68dD74beB6723620eBaD0c) |
| [IexecPocoAccessorsDelegate](https://github.com/iExecBlockchainComputing/PoCo/blob/v5/contracts/modules/delegates/IexecAccessorsABILegacyDelegate.sol)                | [0xAa567D6C87C465A5a15b8efAe4778acD33e6Cd66](https://blockscout-bellecour.iex.ec/address/0xAa567D6C87C465A5a15b8efAe4778acD33e6Cd66) |


## Newly deployed modules

```
Deploying modules..
Deployer: 0x0B3a38b0A47aB0c5E8b208A703de366751Df5916
IexecOrderManagementDelegate: 0xDF63F026779E31AcD1DB4626b39Ea5148f7B9AA4
IexecPoco1Delegate: 0x1eE1cceF893DF6c4D3FC4eCaF315F09183f3048c
IexecPoco2Delegate: 0x7eCf076343FBe296Da2D39f20B2a01AaBB68CC27
IexecPocoAccessorsDelegate: 0xa1d371eF7bf36e89Db41276543ACf91Ec50Dd261
```

| Contract                     | Address                                    | Blockscout                                                                                                                | Deployment                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IexecOrderManagementDelegate | 0xDF63F026779E31AcD1DB4626b39Ea5148f7B9AA4 | [verified](https://blockscout-bellecour.iex.ec/address/0xDF63F026779E31AcD1DB4626b39Ea5148f7B9AA4/contracts#address-tabs) | [0x072d8d4e392bc67367e7434a88ac063c876973edee5637568d9c8462f8eec552](https://blockscout-bellecour.iex.ec/tx/0x072d8d4e392bc67367e7434a88ac063c876973edee5637568d9c8462f8eec552) |
| IexecPoco1Delegate           | 0x1eE1cceF893DF6c4D3FC4eCaF315F09183f3048c | [verified](https://blockscout-bellecour.iex.ec/address/0x1eE1cceF893DF6c4D3FC4eCaF315F09183f3048c/contracts#address-tabs) | [0xc975f4c94fba7a19573d6094aff9178a21d07e3f2e13c8944a0bcb62f62cb6a8](https://blockscout-bellecour.iex.ec/tx/0xc975f4c94fba7a19573d6094aff9178a21d07e3f2e13c8944a0bcb62f62cb6a8) |
| IexecPoco2Delegate           | 0x7eCf076343FBe296Da2D39f20B2a01AaBB68CC27 | [verified](https://blockscout-bellecour.iex.ec/address/0x7eCf076343FBe296Da2D39f20B2a01AaBB68CC27/contracts#address-tabs) | [0x4013dcc930acc2ac5fa53f4ad1062e4b6bd0deb6945972534b2db3586a6617d1](https://blockscout-bellecour.iex.ec/tx/0x4013dcc930acc2ac5fa53f4ad1062e4b6bd0deb6945972534b2db3586a6617d1) |
| IexecPocoAccessorsDelegate   | 0xa1d371eF7bf36e89Db41276543ACf91Ec50Dd261 | [verified](https://blockscout-bellecour.iex.ec/address/0xa1d371eF7bf36e89Db41276543ACf91Ec50Dd261/contracts#address-tabs) | [0xcc90f94b6ddb809720f94271b7b58bef9b24c4fe6e92a72f1271c5f83912081f](https://blockscout-bellecour.iex.ec/tx/0xcc90f94b6ddb809720f94271b7b58bef9b24c4fe6e92a72f1271c5f83912081f) |


## Scheduled upgrade

```
Block#30158507: Mon Sep 23 2024 17:31:40 GMT+0200 (Central European Summer Time) (timestamp:1727105500)
Timelock proposer: 0x0B3a38b0A47aB0c5E8b208A703de366751Df5916
```
- Tx: https://blockscout-bellecour.iex.ec/tx/0x59c94a0206187ff9cfe36bf380dfa012f25b51189e321ed70650827230ab8bd7


## Functions about to be added to and / or modified on proxy:
```
- manageAppOrder(((address,uint256,uint256,bytes32,address,address,address,bytes32,bytes),uint8,bytes));
- manageDatasetOrder(((address,uint256,uint256,bytes32,address,address,address,bytes32,bytes),uint8,bytes));
- manageRequestOrder(((address,uint256,address,uint256,address,uint256,address,uint256,bytes32,uint256,uint256,address,address,string,bytes32,bytes),uint8,bytes));
- manageWorkerpoolOrder(((address,uint256,uint256,bytes32,uint256,uint256,address,address,address,bytes32,bytes),uint8,bytes));
- owner();
- renounceOwnership();
- transferOwnership(address);
- matchOrders((address,uint256,uint256,bytes32,address,address,address,bytes32,bytes),(address,uint256,uint256,bytes32,address,address,address,bytes32,bytes),(address,uint256,uint256,bytes32,uint256,uint256,address,address,address,bytes32,bytes),(address,uint256,address,uint256,address,uint256,address,uint256,bytes32,uint256,uint256,address,address,string,bytes32,bytes));
- owner();
- renounceOwnership();
- sponsorMatchOrders((address,uint256,uint256,bytes32,address,address,address,bytes32,bytes),(address,uint256,uint256,bytes32,address,address,address,bytes32,bytes),(address,uint256,uint256,bytes32,uint256,uint256,address,address,address,bytes32,bytes),(address,uint256,address,uint256,address,uint256,address,uint256,bytes32,uint256,uint256,address,address,string,bytes32,bytes));
- transferOwnership(address);
- verifyPresignature(address,bytes32);
- verifyPresignatureOrSignature(address,bytes32,bytes);
- verifySignature(address,bytes32,bytes);
- claim(bytes32);
- claimArray(bytes32[]);
- contribute(bytes32,bytes32,bytes32,address,bytes,bytes);
- contributeAndFinalize(bytes32,bytes32,bytes,bytes,address,bytes,bytes);
- finalize(bytes32,bytes,bytes);
- initialize(bytes32,uint256);
- initializeAndClaimArray(bytes32[],uint256[]);
- initializeArray(bytes32[],uint256[]);
- owner();
- renounceOwnership();
- reopen(bytes32);
- reveal(bytes32,bytes32);
- transferOwnership(address);
- computeDealVolume((address,uint256,uint256,bytes32,address,address,address,bytes32,bytes),(address,uint256,uint256,bytes32,address,address,address,bytes32,bytes),(address,uint256,uint256,bytes32,uint256,uint256,address,address,address,bytes32,bytes),(address,uint256,address,uint256,address,uint256,address,uint256,bytes32,uint256,uint256,address,address,string,bytes32,bytes));
- owner();
- renounceOwnership();
- transferOwnership(address);
- viewDeal(bytes32);
- viewTask(bytes32);
```
