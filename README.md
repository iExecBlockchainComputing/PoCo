# Introduction

This repository contains the smart contract implementation of iExec's PoCo protocol.

## Related articles on medium

- [PoCo Series #1 — About Trust and Agents Incentives](https://medium.com/iex-ec/about-trust-and-agents-incentives-4651c138974c)
- [PoCo Series #2 — On the use of staking to prevent attacks](https://medium.com/iex-ec/poco-series-2-on-the-use-of-staking-to-prevent-attacks-2a5c700558bd)
- [PoCo Series #3 — PoCo protocol update](https://medium.com/iex-ec/poco-series-3-poco-protocole-update-a2c8f8f30126)
- [PoCo Series #4 — Enclaves and Trusted Executions](https://medium.com/iex-ec/poco-series-4-sgx-enclaves-and-trusted-executions-6f2ebed8d4fa)
- [PoCo Series #5 — Open decentralized brokering on the iExec platform](https://medium.com/iex-ec/poco-series-5-open-decentralized-brokering-on-the-iexec-platform-67b266e330d8)
- [PoCo Series #6 — Smart Contract Upgradeability and Governance](https://medium.com/iex-ec/poco-series-6-smart-contract-upgradeability-and-governance-68d2cdecd120)
- [PoCo Series #8 — Future-proofing iExec - Smart Contract Interoperability and Modularity](https://medium.com/iex-ec/poco-series-8-future-proofing-iexec-smart-contract-interoperability-and-modularity-37a3d3613f11)

## PoCo UML

- [Contracts and Actors Architecture](./docs/README.md#contracts-and-actors-architecture)
- [State diagrams](./docs/Statuses.md)
- [Storage diagram (Boost)](./docs/uml/storage-IexecPocoBoostDelegate.svg)
- [Nominal workflow sequence](./docs/README.md#nominal)
- [Nominal workflow sequence w/ TEE](./docs/README.md#nominaltee)
- [Boost workflow sequence](./docs/README.md#boost)
- UML classes related to:
    - [IexecPocoDelegates](./docs/uml/class-uml-IexecPocoDelegates.svg)
    - [IexecPocoBoostDelegate](./docs/uml/class-uml-IexecPocoBoostDelegate.svg)
    - [IexecEscrows](./docs/uml/class-uml-IexecEscrows.svg)
    - [iExec PoCo registries](./docs/uml/class-uml-dir-registries.svg)
    - [iExec PoCo libraries](./docs/uml/class-uml-dir-libs.svg)
    - [iExec PoCo modules](./docs/uml/class-uml-dir-modules.svg)

## Documentation

- [Full PoCo documentation](https://protocol.docs.iex.ec/key-concepts/proof-of-contribution)

# How to?

## Configure a deployment

Starting from version 5, the PoCo uses a modular design based on [ERC1538](https://github.com/ethereum/EIPs/issues/1538). The migration scripts and tests will use different modules and deployment process depending on the required configuration. In particular, the configuration can use a [create2 factory](https://github.com/iExecBlockchainComputing/iexec-solidity/blob/master/contracts/Factory/GenericFactory.sol) for the deployment, and enable native token or ERC20 token based escrow depending on the targeted blockchain. This means that the codebase is the same on public blockchains (ERC20 based RLC) and dedicated sidechains (Native token based RLC).

The configuration file is located in `./config/config.json`.

It contains:
- A list of categories created during the deployment process. Additional categories can be created by the contract administrator using the `createCategory` function.
- For each chain id, a quick configuration:
	- **"asset":** can be "Token" or "Native", select which escrow to use.
	- **"token":** the address of the token to use. If asset is set to token, and no token address is provided, a mock will be deployed on the fly.
	- **"etoken:"** the address of the enterprise token (with KYC) to use in the case of an enterprise deployment. If asset is set to token, and no etoken address is provider, an instance of the eRLC token (backed by the token described earlier) will automatically be deployed.
	- **"v3":** a list of resources from a previous (v3) deployment. This allows previous resources to be automatically available. It also enables score transfer from v3 to v5. [optional]
	- **"v5":** deployment parameters for the new version. If usefactory is set to true, and no salt is provided, `bytes32(0)` will be used by default.

If you want to deploy the iExec PoCo V5 smart contracts on a new blockchain, the recommended process is to:

0. Edit the `./config/config.json` file as follows:
1. Create a new entry under "chains" with your chain id;
2. Set the asset type depending on your blockchain;
3. If you are using `"asset": "Token"`, provide the address of the token you want to use;
4. Unless you know what you are doing, leave all `"v3"` resources to `Null`;
5. Use the factory with the same salt as the other blockchains, and use the same wallet as previous deployments to have the same deployment address on this new blockchain.

## Additional configuration & environment variables

Environment variable can be used to alter the configuration of a deployment:
- **KYC**: if set, the `KYC` envvar will enable the kyc mechanism of the enterprise marketplace during migration and testing. This is only compatible with `asset="Token"`.
- **SALT**: if set, the `SALT` envvar will overwrite the salt parameter from the config. This can be useful to distinguish public and enterprise deployment without modifying the config.

Additionally, the migration process will look for some smart contracts before deploying new instances. This is true of the application, dataset and workerpool registries. Thus, if both an enterprise and a public marketplace are deployed to the same network, they will share these registries.

## Build

The PoCo smart contracts are in the `./contracts` folder. Json artifacts, containing the contracts bytecode and ABI can be found in the `./build` folder. In case you need to regenerate them, you can use the following command:
```
npm install
npm run build
```

## Test

### Automatic testing

PoCo smart contracts come with a test suite in the `./test` folder. You can startup a sandbox blockchain and run the tests using the following command:

```
npm install
npm run autotest
```

Additionally, you can produce a coverage report using the following command:
```
npm run coverage
```

The automatic testing command uses the Hardhat network by default to run the tests.

### Testing on a custom blockchain

1. Start a blockchain
    -   You can either use the Hardhat CLI with the following command:
    ```
    npx hardhat node [<any additional arguments>]
    ```
    - Or run any other blockchain client.
2. **[Optional]** Update the configuration
    
    If your blockchain listen to a port that is not 8545, or if the blockchain is on a different node, update the `hardhat.config.ts` configuration (network ports, accounts with mnemonic, ..) accordingly to the [Hardhat Configuration](https://hardhat.org/hardhat-runner/docs/config) documentation.
3. Run tests
```
npm run test
```

## Deploy

You can deploy the smart contracts according to the [deploy/0_deploy.ts](./deploy/0_deploy.ts) content. This will automatically save some addresses of the deployed artifacts to the `./build` folder.

To do so:

1. Make sure you followed the "Configure a deployment" section;
2. Enter your targeted blockchain parameters in `hardhat.config.ts` configuration file;
3. Run the deployment using:
```
npx hardhat deploy --network <your network name>
```

Example of "complex" deployment:

```
SALT=0x0000000000000000000000000000000000000000000000000000000000000001 KYC=1 npx hardhat deploy --network hardhat
```

## Render UML diagrams

To render all UML diagrams:
```
npm run uml
```

### Render only class diagrams

```
npm run sol-to-uml
```

### Render only .puml files

```
npm run puml-to-links
```

### Render only storage diagrams

```
npm run storage-to-diagrams
```
