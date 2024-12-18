# Changelog

## vNEXT

### Updated contracts
- [x] `IexecPoco2Delegate.sol`

### Features
- Remove reused code in `IexecPoco2Delegate` in `contribute(...)` function. (#168)
- Remove unnecessary back and forth transfers in `IexecPoco2Delegate` happening during `claim(..)`. (#167)
- Remove references to blockscout v5. (#161)
- Migrate integration test files to Typescript & Hardhat:
    - 000_fullchain.js (#156, #157)
    - 00X_fullchain-Xworkers.js (#158, #159)
    - 000_fullchain-5workers-1error.js (#160, #162)
    - Clean ToDo (#163)
    - 200_fullchain-bot.js (#164, #166)
    - Fix balance checks in integration tests (#165)
- Remove `smock` from unit tests:
    - IexecEscrow.v8 (#154, #155)
    - IexecPocoDelegate (#149, #151)
    - IexecPocoBoost (#148, #150, #153)
- Migrate unit test files to Typescript & Hardhat:
    - ERC1154 (#145, #146, #147, #152)
    - IexecEscrowToken (#141, #143)
    - IexecRelay (#140)
    - IexecPoco1 (#136, #137)
    - IexecPoco2
        - kitty (#142, #144)
        - reopen (#135)

## v5.5.0

### What's new?
- Added the ability to sponsor a deal for a requester via the new `sponsorMatchOrders(..)` function.
    - contracts implementation ✍️
    - deployment on iExec Bellecour network 🚀
- Initialized « boost » mode to improve deal throughput
    - contracts implementation ✍️

### More details
- Include `IexecOrderManagement` module in Poco sponsoring upgrade. (#132)
- Update function visibilities to `external` in `IexecPoco` and `IexecOrderManagement` modules. (#131)
- Fix configs native and token. (#129)
- Bump dependencies: (#127)
    - `@openzeppelin/hardhat-upgrades`, `hardhat-dependency-compiler`, `web3`,
        `prettier`, `zx`, and others [minor/patch version bump]
    - `prettier-plugin-organize-imports@4`
- Clean some TODOs and harmonize unit tests. (#123)
- Add `set-callback-gas.ts` script. (#121)
- Accept any signature format in `SignatureVerifier.v8` when the account is a smart contract. (#120)
- Update UML class diagrams. (#112)
- Generate Solidity documentation. (#111)
- Migrate unit test files to Typescript & Hardhat:
    - Resources (#125, #126)
    - Registries (#122, #124)
    - IexecPoco2
        - reopen (#133)
        - finalize (#79, #117, #119)
        - reveal (#114, #118)
        - contribute (#108, #109, #110)
    - IexecPoco1 (#107, #113, #115, #116)
    - Add `.test` suffix to unit test files (#106)
    - ENSIntegration (#105)
    - IexecOrderManagement (#101, #102, #103, #104)
    - IexecMaintenance (#100)
    - IexecEscrowNative (#99)
    - IexecERC20 (#98)
    - IexecCategoryManager (#97)
    - IexecAccessors (#96)
- Wait for transactions occurring during deployment. (#95)
- Deploy and configure ENS with hardhat. (#93)
- Fix contribute & finalize with callbacks. (#92)
- [Deploy Poco sponsoring on local fork of Bellecour](./scripts/sponsoring/README.md). (#91)
- Create slither smart contract entry point and run slither analysis on new contracts. (#87)
- Upgrade to `@openzeppelin/contracts@5.0.2` and upgrade other dependencies. (#86)
- Deploy IexecPocoAccessorsDelegate module. (#85)
- Create `_computeDealVolume` and expose `ComputeDealVolume` functions (#82)
- Upgrade Order Management to solidity `^0.8.0`. (#84)
- Resolve naming conflict in accessors. (#81)
- Refund sponsor on `claimBoost`. (#80)
- Seize sponsor on success task. (#79)
- Refund sponsor on `claim`. (#77)
- Sponsor match orders boost. (#67, #78)
- Migrate to hardhat tests related to:
    - `initialize` (#74, #75)
    - `claim` (#65, #66, #72, #76)
- Upgrade Poco2 to solidity v0.8 . (#63)
- Use common helpers in Poco Boost integration tests. (#62)
- Upload coverage reports to Codecov. (#61)
- Deploy contracts in tests explicitly with hardhat or truffle fixture. (#59)
- Add the ability to deploy without truffle fixture. (#58)
- Sponsor match orders. (#57, #60)
- Upgrade Poco1 to solidity `^0.8.0` (#55):
    - Migrate to `openzeppelin@v5`
    - Migrate to `SignatureVerifier.v8`
- Change MNEMONIC var name for production & clean Hardhat file. (#53)
- Format files & update copyright notices:
    - DelegateBase, IexecERC20Core (#64)
    - PoCo2 contracts (#54)
    - PoCo1 contracts (#52)
    - Order Management contract (#83)
- Remove enterprise mode. (#51, #56)
- Add PoCo Boost modules to a timelock controlled proxy.
- Add IexecEscrow.v8 tests and developer notices.
- Add tests around callback feature verifying interests of actors are guaranteed.
- Reformat JS files.
- Create a hardhat network close to the iExec Bellecour blockchain.
- Merge settings and v8Settings using object spread.
- Remove useless files.
- Add Slither config. Run single contract Slither analysis on CI.
- Make Poco Boost ITs runnable with "native" mode.
- Migrate puml2links.sh to zx.
- Update copyright and license notices.
- Introduce zx for task scripting.
- Compile latest contracts with 0.8.21.
- Use a single 0.8.19 solidity version to compile latest contracts.
- Fix prettier solidity plugin resolution.
- Remove patched test helpers.
- Clean poco-chain files.
- Bump dependencies.
- Check balance in transfer operation.
- Reformat tests.
- Reformat contracts.
- Add mocha to use test explorer.
- Refactor tests.
- Add dedicated Poco Boost accessors.
- Implement `claimBoost`:
    - Refund requester.
    - Seize workerpool and reward kitty.
- Implement `pushResultBoost`:
    - Verify task exists.
    - Push result before deadline.
    - Require enclave challenge when TEE bit of tag set.
    - Verify signatures
        - scheduler
        - enclave
        - tee broker
    - Reward worker.
    - Reward app provider.
    - Reward dataset provider.
    - Unlock scheduler stake.
    - Reward scheduler.
    - Handle callback.
- Implement `matchOrdersBoost`:
    - Verify compatibility of orders
        - trust
        - category
        - price
        - tag
        - restrictions
            - Assets or requester belong to groups in ERC734 identity contract.
    - Verify entries are registered & category exists.
    - Verify signatures or presignatures of orders.
            - ERC1271 contracts can be signers of orders.
    - Compute volume & consume orders.
    - Lock requester deal value.
    - Store deal.
    - Emit events.
    - Lock scheduler stake.
    - Return `dealId`.
    - Reduce gas footprint:
        - Remove beneficiary from deal storage.
        - Reduce Boost deal storage from 6 to 5 slots.
        - Reduce gas consumption on `lock()` calls.
        - Cache addresses of assets and requester from arguments.
        - Init local vars and cache order category.
        - Optimize deal storing by slot.
        - Change local structure for local variables.
        - Store in variable if read multiple times.
        - Group `hasDataset` block.
    - Remove useless variable.
- Update prettier rules and reformat.
- Migrate `IexecPocoBoost` linking to hardhat deploy script.
- Clean files related to docker build of a test blockchain.
- Run automatically before commit a prettier on `.ts` and `.sol` staged files.
- Upgrade `eth_signTypedData` function to use `ethers`. Remove now useless `eth-sig-util`.
- Init Boost deal structure.
- Publish coverage report on CI/CD. Refactor Jenkinsfile.
- Deploy Nominal and Boost modules with Hardhat.
- Upgrade `hashStruct` function to use `ethers`.
- Add Boost module.
    - Add interfaces.
- Add `Store` contract compatible with solidity `^0.8.0`.
- Update documentation:
    - Generate class diagrams from solidity contracts.
    - Add task and contribution state diagrams.
    - Add boost workflow sequence diagram. Update nominal workflow sequence diagram.
    - Update TEE workflow sequence diagram.
    - Update actors diagram.
    - Rename UMLs.md file to standard README.md.
    - Add inline solidity documentation.
    - Update class diagrams.
    - Create folder docs that contains all documentation material.
- Migrate to Hardhat:
    - Init Hardhat project.
    - Migrate unit tests with `@nomiclabs/hardhat-truffle5`.
    - Fetch `@iexec/solidity@0.1.1` from default public registry.
    - Migrate tests coverage with [solidity-coverage](https://github.com/sc-forks/solidity-coverage) of `@nomicfoundation/hardhat-toolbox`.

## v5.4.2
- Use latest Nethermind base image `nethermindeth/nethermind:iexec`
(saved internally at `nexus.intra.iex.ec/nethermind:1.18.x-0`)
containing a fix for [#5506](https://github.com/NethermindEth/nethermind/issues/5506).

## v5.4.1

- Fix default `poco-chain` `CMD`. (#127)

## v5.3.2

- remove EIP 1559 for native testchains
- drop testchain ganache 1s builds in favor of custom cmd (use `--miner.blockTime 1`)
- add FIFS ens domains in testchains migrations

## v5.3.1

- updated dev deps
- migrated from parity to openethereum
- upgraded ganache from v6 to v7
- updating testchains to support london and arrow-glacier hardforks

## v5.3.0

- added iExec enterprise
