
[![Build Status](https://drone.iex.ec/api/badges/iExecBlockchainComputing/PoCo-dev/status.svg)](https://drone.iex.ec/iExecBlockchainComputing/PoCo-dev)


# Introduction

This repository contains the smart contract implementation of iExec's PoCo protocole.

## Related articles on medium

- [PoCo Series #1 — About Trust and Agents Incentives](https://medium.com/iex-ec/about-trust-and-agents-incentives-4651c138974c)
- [PoCo Series #2 — On the use of staking to prevent attacks](https://medium.com/iex-ec/poco-series-2-on-the-use-of-staking-to-prevent-attacks-2a5c700558bd)
- [PoCo Series #3 — PoCo protocole update](https://medium.com/iex-ec/poco-series-3-poco-protocole-update-a2c8f8f30126)
- [PoCo Series #4 — Enclaves and Trusted Executions](https://medium.com/iex-ec/poco-series-4-sgx-enclaves-and-trusted-executions-6f2ebed8d4fa)
- [PoCo Series #5 — Open decentralized brokering on the iExec platform](https://medium.com/iex-ec/poco-series-5-open-decentralized-brokering-on-the-iexec-platform-67b266e330d8)
- [PoCo Series #6 — Smart Contract Upgradeability and Governance](https://medium.com/iex-ec/poco-series-6-smart-contract-upgradeability-and-governance-68d2cdecd120)
- [PoCo Series #8 — Future-proofing iExec - Smart Contract Interoperability and Modularity](https://medium.com/iex-ec/poco-series-8-future-proofing-iexec-smart-contract-interoperability-and-modularity-37a3d3613f11)

## PoCo UML

- [Contracts and Actors Architecture](./uml/architecture-ODB.png)
- [Nominal workflow sequence](./uml/nominalworkflow-ODB.png)
- [Nominal workflow sequence w/ TEE](./uml/nominalworkflow-ODB+TEE.png)

## Documentation

- [Full PoCo documentaion](https://docs.iex.ec/key-concepts/proof-of-contribution)

# How to?

## Configure a deployment

Starting from version 5, the PoCo uses a modular design based on [ERC1538](https://github.com/ethereum/EIPs/issues/1538). The migration scripts and tests will use different modules and deployment process depending on the required configuration. In particular, the configuration can use a [create2 factory](https://github.com/iExecBlockchainComputing/iexec-solidity/blob/master/contracts/Factory/GenericFactory.sol) for the deployment, and enable native token or ERC20 token based escrow depending on the targeted blockchain. This means that the codebase is the same on public blockchains (ERC20 based RLC) and dedicated sidechains (Native token based RLC).

The configuration file is located in `./config/config.json`.

It contains:
- A list of categories created during the deployment process. Additional categories can be created by the contract administrator using the `createCategory` function.
- For each chainid, a quick configuration:
	- **"asset":** can be "Token" or "Native", select which escrow to use.
	- **"token":** the address of the token to use. If asset is set to token, and no token address is provided, a mock will be deployed on the fly.
	- **"etoken:"** the address of the enterprise token (with KYC) to use in the case of an enterprise deployment. If asset is set to token, and no etoken address is provider, an instance of the eRLC token (backed by the token described earlier) will automatically be deployed.
	- **"v3":** a list of ressources from a previous (v3) deployment. This allows previous ressources to be automatically available. It also enables score transfer from v3 to v5. [optional]
	- **"v5":** deployment parameters for the new version. If usefactory is set to true, and no salt is provided, `bytes32(0)` will be used by default.

If you want to deploy the iExec PoCo V5 smart contracts on a new blockchain, the recommanded process is to:

0. Edit the `./config/config.json` file as follows:
1. Create a new entry under "chains" with your chainid;
2. Set the asset type depending on your blockchain;
3. If you are using `"asset": "Token"`, provide the address of the token you want to use;
4. Unless you know what you are doing, leave all `"v3"` ressources to `Null`;
5. Use the factory with the same salt as the other blockchains, and use the same wallet as previous deployments to have the same deployment address on this new blockchain.

## Additional configuration & environment variables

Environement variable can be used to alter the configuration of a deployment:
- **KYC**: if set, the `KYC` envvar will enable the kyc mechanism of the enterprise marketplace during migration and testing. This is only compatible with `asset="Token"`.
- **SALT**: if set, the `SALT` envvar will overwrite the salt parameter from the config. This can be usefull to distinguish public and enterprise deployment without modifying the config.

Additionnaly, the migration process will look for some smartcontracts before deploying new instances. This is true of the application, dataset and workerpool registries. Thus, if both an enterprise and a public marketplace are deployed to the same network, they will share these registries.

## Build

The PoCo smart contracts are in the `./contracts` folder. Json artefacts, containing the contracts bytecode and ABI can be found in the `./build` folder. In case you need to regenerate them, you can use the following command:
```
npm install
npm run build
```

## Test

### Automatic testing

The PoCo smart contracts come with a test suite in the `./test` folder. You can startup a sandbox blockchain and run the tests using the following command:

```
npm install
npm run autotest fast
```

Additionnaly, you can produce a coverage report using the following command:
```
npm run coverage
```

The automatic testing command uses a `ganache-cli` blockchain instance to run the tests. You can also use your own blockchain endpoint to run these tests.

### Testing on a custom blockchain

1. Start your blockchain. You can either use ganache with the following command:
```
ganache-cli <any additional arguments>
```
or run any other blockchain client.
2. **[Optional]** If your blockchain listen to a port that is not 8545, or if the blockchain is on a different node, update the `./truffle.js` configuration accordingly (see the documentation [here](https://www.trufflesuite.com/docs/truffle/reference/configuration)).
3. Run the tests using:
```
npm run test
```
or
```
truffle test
```

## Deploy

You can deploy the smart contracts according to the [3_deploy_contracts.js](./migrations/3_deploy_contracts.js) content. This will automatically save the addresses of the deployed artefacts to the `./build` folder.

To do so:

1. Make sure you followed the "Configure a deployment" section;
2. Enter your targeted blockchain parameters in `truffle.js` configuration file;
3. Run the deployment using:
```
npm run migrate -- --network <your network name>
```

Example of "complexe" deployment:

```
SALT=0x0000000000000000000000000000000000000000000000000000000000000001 KYC=1 npm run migrate -- --network goerli ---skip-dry-run
```
