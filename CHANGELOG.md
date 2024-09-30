# Changelog

## vNEXT
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
        - reopen (#133, #135)
        - finalize (#79, #117, #119)
        - reveal (#114, #118)
        - contribute (#108, #109, #110)
    - IexecPoco1 (#107, #113, #115, #116, #136, #137)
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

## v5.5.0 - PoCo Boost
- Migrate to Hardhat:
    - Init Hardhat project.
    - Migrate unit tests with `@nomiclabs/hardhat-truffle5`.
    - Fetch `@iexec/solidity@0.1.1` from default public registry.
    - Migrate tests coverage with [solidity-coverage](https://github.com/sc-forks/solidity-coverage) of `@nomicfoundation/hardhat-toolbox`.
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
- Add `Store` contract compatible with solidity `^0.8.0`.
- Add Boost module.
    - Add interfaces.
- Upgrade `hashStruct` function to use `ethers`.
- Deploy Nominal and Boost modules with Hardhat.
- Publish coverage report on CI/CD. Refactor Jenkinsfile.
- Init Boost deal structure.
- Upgrade `eth_signTypedData` function to use `ethers`. Remove now useless `eth-sig-util`.
- Run automatically before commit a prettier on `.ts` and `.sol` staged files.
- Clean files related to docker build of a test blockchain.
- Migrate `IexecPocoBoost` linking to hardhat deploy script.
- Update prettier rules and reformat.
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
- Implement `claimBoost`:
    - Refund requester.
    - Seize workerpool and reward kitty.
- Add dedicated Poco Boost accessors.
- Refactor tests.
- Add mocha to use test explorer.
- Reformat contracts.
- Reformat tests.
- Check balance in transfer operation.
- Bump dependencies.
- Clean poco-chain files.
- Remove patched test helpers.
- Fix prettier solidity plugin resolution.
- Use a single 0.8.19 solidity version to compile latest contracts.
- Compile latest contracts with 0.8.21.
- Introduce zx for task scripting.
- Update copyright and license notices.
- Migrate puml2links.sh to zx.
- Make Poco Boost ITs runnable with "native" mode.
- Add Slither config. Run single contract Slither analysis on CI.
- Remove useless files.
- Merge settings and v8Settings using object spread.
- Create a hardhat network close to the iExec Bellecour blockchain.
- Reformat JS files.
- Add tests around callback feature verifying interests of actors are guaranteed.
- Add IexecEscrow.v8 tests and developer notices.
- Add PoCo Boost modules to a timelock controlled proxy.

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
