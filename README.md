# iExec PoCo Smart Contracts

[![codecov](https://codecov.io/github/iExecBlockchainComputing/PoCo/graph/badge.svg)](https://codecov.io/github/iExecBlockchainComputing/PoCo)

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

## PoCo UMLs

- [Contracts and Actors Architecture](./docs/README.md#contracts-and-actors-architecture)
- [State diagrams](./docs/Statuses.md)
- [Nominal workflow sequence](./docs/README.md#nominal)
- [Nominal workflow sequence w/ TEE](./docs/README.md#nominaltee)
- [Boost workflow sequence](./docs/README.md#boost)
- Storage diagrams
    - [Diamond storage](./docs/uml/storage-diagram-diamond.svg)
    - [PoCo storage](./docs/uml/storage-diagram-poco.svg)
- UML classes related to:
    - [IexecPoco1Facet & IexecPoco2Facet](./docs/uml/class-uml-IexecPocoFacets.svg)
    - [IexecPocoBoostFacet](./docs/uml/class-uml-IexecPocoBoostFacet.svg)
    - [IexecEscrows](./docs/uml/class-uml-IexecEscrows.svg)
    - [iExec PoCo registries](./docs/uml/class-uml-dir-registries.svg)
    - [iExec PoCo libraries](./docs/uml/class-uml-dir-libs.svg)
    - [iExec PoCo modules (facets)](./docs/uml/class-uml-dir-facets.svg)

## Documentation

- [Solidity API documentation](./docs/solidity/index.md)
<!-- TODO update with new documentation URL -->
- [Full PoCo documentation](https://docs.iex.ec/protocol/proof-of-contribution)

## Audits

All contract audit files can be found in [audit/](./audit/) folder.

# How to?

## Configure a deployment

Starting from version 5, the PoCo uses a modular design based on [ERC-2535](https://eips.ethereum.org/EIPS/eip-2535). The migration scripts and tests will use different modules (facets) and deployment process depending on the required configuration. In particular, the configuration can use a [create2 factory](https://github.com/iExecBlockchainComputing/iexec-solidity/blob/master/contracts/Factory/GenericFactory.sol) for the deployment, and enable native token or ERC20 token based escrow depending on the targeted blockchain. This means that the codebase is the same on public blockchains (ERC20 based RLC) and dedicated sidechains (Native token based RLC).

The configuration file is located in `./config/config.json`.

It contains:
- A list of categories created during the deployment process. Additional categories can be created by the contract administrator using the `createCategory` function.
- For each chain id, a quick configuration:
	- **"asset":** can be "Token" or "Native", select which escrow to use.
	- **"token":** the address of the token to use. If asset is set to token, and no token address is provided, a mock will be deployed on the fly.
	- **"v3":** a list of resources from a previous (v3) deployment. This allows previous resources to be automatically available. It also enables score transfer from v3 to v5. [optional]
	- **"v5":** deployment parameters for the new version. If factory address is set, and no salt is provided, `bytes32(0)` will be used by default.

If you want to deploy the iExec PoCo V5 smart contracts on a new blockchain, the recommended process is to:

0. Edit the `./config/config.json` file as follows:
1. Create a new entry under "chains" with your chain id;
2. Set the asset type depending on your blockchain;
3. If you are using `"asset": "Token"`, provide the address of the token you want to use;
4. Unless you know what you are doing, leave all `"v3"` resources to `Null`;
5. Use the factory with the same salt as the other blockchains, and use the same wallet as previous deployments to have the same deployment address on this new blockchain.

## Additional configuration & environment variables

Environment variable can be used to alter the configuration of a deployment:
- **SALT**: if set, the `SALT` env var will overwrite the salt parameter from the config. This can be useful to distinguish different deployments without modifying the config.

Additionally, the migration process will look for some smart contracts before deploying new instances. This is true of the application, dataset and workerpool registries. Thus, if different marketplaces are deployed to the same network, they will share these registries.

# Development

This project uses trunk-based development workflow with automatic release management. It means that:
- Only squash merge commits are accepted.
- When merging a PR, its title is used as the commit message.
- A check is added to enforce using the correct format for PR titles (feat:..., fix:..., ...).
- Release please is used to manage Github releases.

## Build

The PoCo smart contracts are in the `contracts/` folder. Json artifacts, containing the contracts bytecode and ABI can be found in the `artifacts/` folder. In case you need to regenerate them, you can use the following command:
```
npm install
npm run build
```

## Test

### Automatic testing

PoCo smart contracts come with a test suite in the `./test` folder. You can startup a sandbox blockchain and run the tests using the following command:

```
npm install
npm run test
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
npm run test -- --network <networkUrl>
```

## Deploy

The iExec PoCo contracts support automated deployment through both command-line interface and GitHub Actions workflows.

### Command Line Deployment

You can deploy the smart contracts according to the [deploy/0_deploy.ts](./deploy/0_deploy.ts) content. This will automatically save addresses of the deployed artifacts to `deployments/` folder.

To deploy using the CLI:

1. Make sure you followed the "Configure a deployment" section above
2. Enter your targeted blockchain parameters in `hardhat.config.ts`
3. Run the deployment using:

```
npm run deploy -- --network <your network name>
```

Example with custom salt:

```
SALT=0x0000000000000000000000000000000000000000000000000000000000000001 npx hardhat deploy --network hardhat
```


### Verification

To verify contracts:

```
npm run verify:all -- --network <your network name> # e.g. arbitrum
```

This script automatically reads all deployed contract addresses and their constructor arguments from the deployment artifacts and verifies them on the relevant block explorer.


## Formatting

Format a specific file or files in a directory:
```
npm run format <filePath|folderPath>
```

## Render UML diagrams

To render all UML diagrams:
```
npm run uml
```

To render only class diagrams:

```
npm run sol-to-uml
```

To render only .puml files:

```
npm run puml-to-links
```

To render only storage diagrams:

```
npm run storage-to-diagrams
```
