# Changelog

## vNEXT

## [6.2.1](https://github.com/iExecBlockchainComputing/PoCo/compare/v6.2.0...v6.2.1) (2026-01-28)


### 📋 Misc

* Fix release please config and changelog file ([#338](https://github.com/iExecBlockchainComputing/PoCo/issues/338)) ([0a033f4](https://github.com/iExecBlockchainComputing/PoCo/commit/0a033f4fad3c436c6001d4d45f583b2cc5817108))
* Update owner address in config after multisig transfer ([#339](https://github.com/iExecBlockchainComputing/PoCo/issues/339)) ([fd0c823](https://github.com/iExecBlockchainComputing/PoCo/commit/fd0c823e03f2fb359420bf0fc9bf18039b7d100d))

## [6.2.0](https://github.com/iExecBlockchainComputing/PoCo/compare/v6.1.0...v6.2.0) (2026-01-21)


### 🚀 Added

* `v6.2.0` upgrade script ([#329](https://github.com/iExecBlockchainComputing/PoCo/issues/329)) ([564ae6b](https://github.com/iExecBlockchainComputing/PoCo/commit/564ae6b709f9861e5fa86c3b961fc4be24bfa51b))
* Ignore TEE framework bits in dataset tags for cross-framework compatibility ([#325](https://github.com/iExecBlockchainComputing/PoCo/issues/325)) ([2349970](https://github.com/iExecBlockchainComputing/PoCo/commit/234997096c4e915a4f719872fe70f5eeac9014ea))
* Use custom errors when receiveApproval fails and set callbackgas to 200k ([#331](https://github.com/iExecBlockchainComputing/PoCo/issues/331)) ([81778ee](https://github.com/iExecBlockchainComputing/PoCo/commit/81778ee095ecf219ce163158a5eb36ec2b6140f8))
* Enable deposit and match orders in a single tx ([#316](https://github.com/iExecBlockchainComputing/PoCo/issues/316)) ([4100b90](https://github.com/iExecBlockchainComputing/PoCo/commit/4100b90fe76f717152ff8742dc419deea021879b))
* Upgrade all contracts to Solidity v0.8.0 ([#287](https://github.com/iExecBlockchainComputing/PoCo/issues/287)) ([55729ad](https://github.com/iExecBlockchainComputing/PoCo/commit/55729ad8e2a53fb24ed8d8b3405147baec9d6d9f))

### ✍️ Changed

* Clean npm dependencies & disable postinstall scripts ([#333](https://github.com/iExecBlockchainComputing/PoCo/issues/333)) ([db44994](https://github.com/iExecBlockchainComputing/PoCo/commit/db44994de69053924e2334ea63f0760d9eee99a1))
* Refactor dataset order tag ignoring code ([#332](https://github.com/iExecBlockchainComputing/PoCo/issues/332)) ([f50b898](https://github.com/iExecBlockchainComputing/PoCo/commit/f50b89874a5cd00159beb117a02fc9140847f372))
* Update CODEOWNERS to correct username for review requests ([#334](https://github.com/iExecBlockchainComputing/PoCo/issues/334)) ([3b0db05](https://github.com/iExecBlockchainComputing/PoCo/commit/3b0db058c1d93edd593f91632b91109a26c7e7ce))
* update sepolia owner ([#335](https://github.com/iExecBlockchainComputing/PoCo/issues/335)) ([16f30e3](https://github.com/iExecBlockchainComputing/PoCo/commit/16f30e3d51b05dbd0c4817bbc9b9ca9e6e564be0))

### 📋 Misc

* add CHANGELOG.md to .prettierignore ([#326](https://github.com/iExecBlockchainComputing/PoCo/issues/326)) ([001a6a6](https://github.com/iExecBlockchainComputing/PoCo/commit/001a6a646f7c1d96a4c00fae467bccc20e0f66f1))
* Clean contracts and tests - part1 ([#330](https://github.com/iExecBlockchainComputing/PoCo/issues/330)) ([52e8fc7](https://github.com/iExecBlockchainComputing/PoCo/commit/52e8fc72e9bd35b2083c65e5cd851b3eaa35a4bf))
* Save upgrade artifacts - arbitrum ([#327](https://github.com/iExecBlockchainComputing/PoCo/issues/327)) ([5ec3166](https://github.com/iExecBlockchainComputing/PoCo/commit/5ec31662fa157346d83193533146e91d62cd3d8d))
* Save upgrade artifacts - arbitrum (runId:21206392301) ([#337](https://github.com/iExecBlockchainComputing/PoCo/issues/337)) ([55c668a](https://github.com/iExecBlockchainComputing/PoCo/commit/55c668ab65ca94505c077c443e9a59de0b168b30))
* Save upgrade artifacts - arbitrumSepolia (runId:20332201318) ([#336](https://github.com/iExecBlockchainComputing/PoCo/issues/336)) ([5b1ec5d](https://github.com/iExecBlockchainComputing/PoCo/commit/5b1ec5dbf98ea6acbe958313d8f454cd3718465c))

## [6.1.0](https://github.com/iExecBlockchainComputing/PoCo/compare/v6.0.0...v6.1.0) (2025-11-13)

> **Main Feature:** Bulk Processing Upgrade – Enables efficient batching of iExec tasks with optimized performance and improved validation for bulk SMS orders.

### 🚀 Features

* **Bulk Processing Functions:** ([#302](https://github.com/iExecBlockchainComputing/PoCo/issues/302), [#327](https://github.com/iExecBlockchainComputing/PoCo/issues/327))
  * `viewApp`, `viewDataset`, `viewWorkerpool` - Read asset details in single transaction
  * `assertDatasetDealCompatibility` - Validate bulk order compatibility with deals for SMS
* **Dataset Validation:** Enhanced compatibility check returning detailed reasons ([#267](https://github.com/iExecBlockchainComputing/PoCo/issues/267), [#266](https://github.com/iExecBlockchainComputing/PoCo/issues/266))
  * Revert if dataset order incompatible with deal ([#278](https://github.com/iExecBlockchainComputing/PoCo/issues/278))
* **SDK Compatibility:** Restore `setName` as nonpayable function ([#286](https://github.com/iExecBlockchainComputing/PoCo/issues/286))

### 🏗️ Architecture

* **Facet Cleanup:** Remove unintentionally added constants getters by changing visibility to `internal` ([#260](https://github.com/iExecBlockchainComputing/PoCo/issues/260))
  * Removes duplicate functions: `CONTRIBUTION_DEADLINE_RATIO()`, `FINAL_DEADLINE_RATIO()`, `GROUPMEMBER_PURPOSE()`, etc.
* **Facet Refactoring:** Migrate IexecAccessorsFacet to IexecPocoAccessorsFacet ([#259](https://github.com/iExecBlockchainComputing/PoCo/issues/259))
* **Boost Removal:** Remove boost facets from Arbitrum Sepolia for mainnet parity ([#299](https://github.com/iExecBlockchainComputing/PoCo/issues/299))

### 🔧 Developer Experience

* **Tooling & CI/CD:**
  * Conventional commits and release-please ([#256](https://github.com/iExecBlockchainComputing/PoCo/issues/256))
  * GitHub Actions for callback gas setting ([#274](https://github.com/iExecBlockchainComputing/PoCo/issues/274))
  * GitHub Actions for facet upgrades ([#289](https://github.com/iExecBlockchainComputing/PoCo/issues/289))
  * Remove precommit hooks, move to CI ([#320](https://github.com/iExecBlockchainComputing/PoCo/issues/320))
* **Verification:**
  * Smart contract verification support ([#277](https://github.com/iExecBlockchainComputing/PoCo/issues/277))
  * Upgrade to etherscan v2 ([#288](https://github.com/iExecBlockchainComputing/PoCo/issues/288))
* **Dependencies:**
  * Upgrade Hardhat ([#313](https://github.com/iExecBlockchainComputing/PoCo/issues/313))

### 📦 Distribution

* **Deployment Artifacts:** Clean up and organize deployment artifacts ([#300](https://github.com/iExecBlockchainComputing/PoCo/issues/300), [#309](https://github.com/iExecBlockchainComputing/PoCo/issues/309))
* **Upgrade Scripts:** Improved facet upgrade tooling ([#298](https://github.com/iExecBlockchainComputing/PoCo/issues/298))
* **Diamond Description:** Print facet names and save diamond structure ([#301](https://github.com/iExecBlockchainComputing/PoCo/issues/301))
* **Upgrade Artifacts:** Save upgrade deployment records ([#302](https://github.com/iExecBlockchainComputing/PoCo/issues/302), [#327](https://github.com/iExecBlockchainComputing/PoCo/issues/327))

## v6.0.0 - Diamond Proxy Pattern (ERC-2535)

### What's new?

#### 🚨 Breaking changes

The proxy architecture has been migrated from [ERC-1538 Transparent Contract Standard](https://eips.ethereum.org/EIPS/eip-1538) to [ERC-2535 Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535).

> **Impact:**
>
> -   **No changes** to on-chain business logic or contract interfaces used by regular clients.
> -   Existing integrations that interact with contract functions will **continue to work without modification**.
> -   **Breaking change** applies only to how the proxy’s upgrade mechanism works and how contract structure is exposed to **indexers, explorers, or tooling** that previously relied on ERC-1538’s upgrade API.

💡 **Versioning note:**
Technically, since public APIs for business logic did not change, this could be a **minor release** under Semantic Versioning.
However, because the upgrade proxy standard changed and this could impact **indexers and tooling**, releasing as a **major** version ensures better visibility of this architectural shift.

##### ❌ Removed functions and events (ERC-1538):

-   `function totalFunctions(...)`
-   `function functionByIndex(...)`
-   `function functionById(...)`
-   `function functionExists(...)`
-   `function functionSignatures(...)`
-   `function delegateFunctionSignatures(...)`
-   `function delegateAddress(...)`
-   `function delegateAddresses(...)`
-   `function updateContract(...)`
-   `event CommitMessage(...)`
-   `event FunctionUpdate(...)`

##### ✨ New functions (ERC-2535)

-   `function diamondCut(FacetCut[] calldata _diamondCut, address _init, bytes calldata _calldata)`
-   `function facets() external view returns (Facet[] memory)`
-   `function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory)`
-   `function facetAddresses() external view returns (address[] memory)`
-   `function facetAddress(bytes4 _selector) external view returns (address)`
-   `event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata)`

### ✍️ Updated contracts

All contracts have been updated (formatting, renaming, …) but **no breaking changes**
have been introduced to the business logic.

### 🚀 Deployment & network support

-   The PoCo protocol is now available on **Arbitrum One Mainnet**.

### More details

-   Update docs and diagrams (#250)
-   Deploy on Arbitrum Mainnet (#249)
-   Add support for Arbitrum Mainnet (#248)
-   Publish NPM package for version `v5.6.0-rc1` (#247)
-   Deploy on Arbitrum Sepolia (#246)
-   Set owner at deployment (#245)
-   Use lib as storage. (#243)
-   Save `IexecLibOrders_v5` in config file (#242)
-   Migrate proxy to **Diamond pattern - ERC-2535** (#241):
    -   Restore compatibility with iExec SDK. (#240)
    -   Target latest EVM version (#239)
    -   Adapt contracts file tree (#238)
    -   Use namespaced storage (#236, #237)
    -   Fix script folder (#235)
    -   Format all solidity files (#233)
    -   Replace ERC1538 wording by diamond Proxy wording (#229, #230, #234)
    -   Update deployment CI (#228)
    -   Format contracts (#227)
    -   Remove ENS module (#225)
    -   Add Diamond contract unit tests (#224)
    -   Fix `fallback` and `receive` (#223)
    -   Init contracts migration (#222)

## v5.5.1 - Fresh development environment

### What's new?

-   Add some small optimizations to `IexecPoco2Delegate` contract (#167, #168).
-   Add support for CreateX factory.
-   Migrate to Ethers v6.
-   Migrate all Javascript files to Typescript.
-   Purge Truffle.
-   Migrate CI from Jenkins to Github Actions.

### Updated contracts

-   [x] `IexecPoco2Delegate.sol`

### More details

-   Release v5.5.1 #220
-   Add gitub action workflow for deployment (#218)
-   Rename Avalanche Fuji and Arbitrum Sepolia network configuration (#217)
-   Deploy on new testnet chains using CreateX factory (#216)
-   Add CreateX factory for new chain deployment (#215)
-   Add Github Action CI in order to publish NPM package (#214)
-   Housekeeping (#208)
-   Add Halborn "Poco v5.5 & Voucher v1.0" audit report (#205)
-   Refactor Factory deployer (#206)
-   Enable native tests on CI (#204)
-   Migrate to Ethers v6:
    -   Deployment scripts (#187, #203)
    -   Tests
        -   IexecEscrow (#199)
        -   ENSIntegration, IexecOrderManagement, IexecRelay (#195, #199)
        -   IexecCategoryManager, IexecERC20 (#192, #199, #202)
        -   test/_fullchain_ (#190, #196)
        -   IexecAccessors, IexecMaintenance (#189, #191, #199)
        -   IexecPoco (#196)
        -   `trust` specific field (#201)
        -   IexecPocoBoost (#198)
        -   fixed a minor issue in BigInt for IexecWrapper (#202).
-   Migrate scripts to TypeScript: (#184)
    -   `getFunctionSignatures.js`, `common-test-snapshot.js`, `test-storage.js`, `timelock.js`
-   Migrated utility files to TypeScript : (#183)
    -   `FactoryDeployer.js`, `constants.js`, `odb-tools.js`
    -   Removed deprecated `scripts/ens/sidechain.js`
-   Purge Truffle leftovers (#180, #181, #182, #185, #186)
-   Sunset Jenkins pipeline (#178)
-   Re-use variable in `IexecPoco2Delegate` in `contribute(...)` function. (#168)
-   Remove unnecessary back and forth transfers in `IexecPoco2Delegate` happening during `claim(..)`. (#167)
-   Remove references to blockscout v5. (#161)
-   Migrate integration test files to Typescript & Hardhat:
    -   000_fullchain.js (#156, #157)
    -   00X_fullchain-Xworkers.js (#158, #159)
    -   000_fullchain-5workers-1error.js (#160, #162)
    -   Clean ToDo (#163)
    -   200_fullchain-bot.js (#164, #166)
    -   201_fullchain-bot-dualPool.js (#171, #172)
    -   Fix balance checks in integration tests (#165)
    -   300_fullchain-reopen.js (#170, #173)
    -   000_fullchain-ABILegacy.js (#174, #175)
    -   400_contributeAndCallback.js (#176, #177)
-   Remove `smock` from unit tests:
    -   IexecEscrow.v8 (#154, #155)
    -   IexecPocoDelegate (#149, #151)
    -   IexecPocoBoost (#148, #150, #153)
-   Migrate unit test files to Typescript & Hardhat:
    -   ERC1154 (#145, #146, #147, #152)
    -   IexecEscrowToken (#141, #143)
    -   IexecRelay (#140)
    -   IexecPoco1 (#136, #137)
    -   IexecPoco2
        -   kitty (#142, #144)
        -   reopen (#135)

## v5.5.0 - Deal sponsoring

### What's new?

-   Added the ability to sponsor a deal for a requester via the new `sponsorMatchOrders(..)` function.
    -   contracts implementation ✍️
    -   deployment on iExec Bellecour network 🚀
-   Initialized « boost » mode to improve deal throughput
    -   contracts implementation ✍️

### More details

-   Include `IexecOrderManagement` module in Poco sponsoring upgrade. (#132)
-   Update function visibilities to `external` in `IexecPoco` and `IexecOrderManagement` modules. (#131)
-   Fix configs native and token. (#129)
-   Bump dependencies: (#127)
    -   `@openzeppelin/hardhat-upgrades`, `hardhat-dependency-compiler`, `web3`,
        `prettier`, `zx`, and others [minor/patch version bump]
    -   `prettier-plugin-organize-imports@4`
-   Clean some TODOs and harmonize unit tests. (#123)
-   Add `set-callback-gas.ts` script. (#121)
-   Accept any signature format in `SignatureVerifier.v8` when the account is a smart contract. (#120)
-   Update UML class diagrams. (#112)
-   Generate Solidity documentation. (#111)
-   Migrate unit test files to Typescript & Hardhat:
    -   Resources (#125, #126)
    -   Registries (#122, #124)
    -   IexecPoco2
        -   reopen (#133)
        -   finalize (#79, #117, #119)
        -   reveal (#114, #118)
        -   contribute (#108, #109, #110)
    -   IexecPoco1 (#107, #113, #115, #116)
    -   Add `.test` suffix to unit test files (#106)
    -   ENSIntegration (#105)
    -   IexecOrderManagement (#101, #102, #103, #104)
    -   IexecMaintenance (#100)
    -   IexecEscrowNative (#99)
    -   IexecERC20 (#98)
    -   IexecCategoryManager (#97)
    -   IexecAccessors (#96)
-   Wait for transactions occurring during deployment. (#95)
-   Deploy and configure ENS with hardhat. (#93)
-   Fix contribute & finalize with callbacks. (#92)
-   [Deploy Poco sponsoring on local fork of Bellecour](./scripts/sponsoring/README.md). (#91)
-   Create slither smart contract entry point and run slither analysis on new contracts. (#87)
-   Upgrade to `@openzeppelin/contracts@5.0.2` and upgrade other dependencies. (#86)
-   Deploy IexecPocoAccessorsDelegate module. (#85)
-   Create `_computeDealVolume` and expose `ComputeDealVolume` functions (#82)
-   Upgrade Order Management to solidity `^0.8.0`. (#84)
-   Resolve naming conflict in accessors. (#81)
-   Refund sponsor on `claimBoost`. (#80)
-   Seize sponsor on success task. (#79)
-   Refund sponsor on `claim`. (#77)
-   Sponsor match orders boost. (#67, #78)
-   Migrate to hardhat tests related to:
    -   `initialize` (#74, #75)
    -   `claim` (#65, #66, #72, #76)
-   Upgrade Poco2 to solidity v0.8 . (#63)
-   Use common helpers in Poco Boost integration tests. (#62)
-   Upload coverage reports to Codecov. (#61)
-   Deploy contracts in tests explicitly with hardhat or truffle fixture. (#59)
-   Add the ability to deploy without truffle fixture. (#58)
-   Sponsor match orders. (#57, #60)
-   Upgrade Poco1 to solidity `^0.8.0` (#55):
    -   Migrate to `openzeppelin@v5`
    -   Migrate to `SignatureVerifier.v8`
-   Change MNEMONIC var name for production & clean Hardhat file. (#53)
-   Format files & update copyright notices:
    -   DelegateBase, IexecERC20Core (#64)
    -   PoCo2 contracts (#54)
    -   PoCo1 contracts (#52)
    -   Order Management contract (#83)
-   Remove enterprise mode. (#51, #56)
-   Add PoCo Boost modules to a timelock controlled proxy.
-   Add IexecEscrow.v8 tests and developer notices.
-   Add tests around callback feature verifying interests of actors are guaranteed.
-   Reformat JS files.
-   Create a hardhat network close to the iExec Bellecour blockchain.
-   Merge settings and v8Settings using object spread.
-   Remove useless files.
-   Add Slither config. Run single contract Slither analysis on CI.
-   Make Poco Boost ITs runnable with "native" mode.
-   Migrate puml2links.sh to zx.
-   Update copyright and license notices.
-   Introduce zx for task scripting.
-   Compile latest contracts with 0.8.21.
-   Use a single 0.8.19 solidity version to compile latest contracts.
-   Fix prettier solidity plugin resolution.
-   Remove patched test helpers.
-   Clean poco-chain files.
-   Bump dependencies.
-   Check balance in transfer operation.
-   Reformat tests.
-   Reformat contracts.
-   Add mocha to use test explorer.
-   Refactor tests.
-   Add dedicated Poco Boost accessors.
-   Implement `claimBoost`:
    -   Refund requester.
    -   Seize workerpool and reward kitty.
-   Implement `pushResultBoost`:
    -   Verify task exists.
    -   Push result before deadline.
    -   Require enclave challenge when TEE bit of tag set.
    -   Verify signatures
        -   scheduler
        -   enclave
        -   tee broker
    -   Reward worker.
    -   Reward app provider.
    -   Reward dataset provider.
    -   Unlock scheduler stake.
    -   Reward scheduler.
    -   Handle callback.
-   Implement `matchOrdersBoost`:
    -   Verify compatibility of orders
        -   trust
        -   category
        -   price
        -   tag
        -   restrictions
            -   Assets or requester belong to groups in ERC734 identity contract.
    -   Verify entries are registered & category exists.
    -   Verify signatures or presignatures of orders.
    -   ERC1271 contracts can be signers of orders.
    -   Compute volume & consume orders.
    -   Lock requester deal value.
    -   Store deal.
    -   Emit events.
    -   Lock scheduler stake.
    -   Return `dealId`.
    -   Reduce gas footprint:
        -   Remove beneficiary from deal storage.
        -   Reduce Boost deal storage from 6 to 5 slots.
        -   Reduce gas consumption on `lock()` calls.
        -   Cache addresses of assets and requester from arguments.
        -   Init local vars and cache order category.
        -   Optimize deal storing by slot.
        -   Change local structure for local variables.
        -   Store in variable if read multiple times.
        -   Group `hasDataset` block.
    -   Remove useless variable.
-   Update prettier rules and reformat.
-   Migrate `IexecPocoBoost` linking to hardhat deploy script.
-   Clean files related to docker build of a test blockchain.
-   Run automatically before commit a prettier on `.ts` and `.sol` staged files.
-   Upgrade `eth_signTypedData` function to use `ethers`. Remove now useless `eth-sig-util`.
-   Init Boost deal structure.
-   Publish coverage report on CI/CD. Refactor Jenkinsfile.
-   Deploy Nominal and Boost modules with Hardhat.
-   Upgrade `hashStruct` function to use `ethers`.
-   Add Boost module.
    -   Add interfaces.
-   Add `Store` contract compatible with solidity `^0.8.0`.
-   Update documentation:
    -   Generate class diagrams from solidity contracts.
    -   Add task and contribution state diagrams.
    -   Add boost workflow sequence diagram. Update nominal workflow sequence diagram.
    -   Update TEE workflow sequence diagram.
    -   Update actors diagram.
    -   Rename UMLs.md file to standard README.md.
    -   Add inline solidity documentation.
    -   Update class diagrams.
    -   Create folder docs that contains all documentation material.
-   Migrate to Hardhat:
    -   Init Hardhat project.
    -   Migrate unit tests with `@nomiclabs/hardhat-truffle5`.
    -   Fetch `@iexec/solidity@0.1.1` from default public registry.
    -   Migrate tests coverage with [solidity-coverage](https://github.com/sc-forks/solidity-coverage) of `@nomicfoundation/hardhat-toolbox`.

## v5.4.2

-   Use latest Nethermind base image `nethermindeth/nethermind:iexec`
    (saved internally at `nexus.intra.iex.ec/nethermind:1.18.x-0`)
    containing a fix for [#5506](https://github.com/NethermindEth/nethermind/issues/5506).

## v5.4.1

-   Fix default `poco-chain` `CMD`. (#127)

## v5.3.2

-   remove EIP 1559 for native testchains
-   drop testchain ganache 1s builds in favor of custom cmd (use `--miner.blockTime 1`)
-   add FIFS ens domains in testchains migrations

## v5.3.1

-   updated dev deps
-   migrated from parity to openethereum
-   upgraded ganache from v6 to v7
-   updating testchains to support london and arrow-glacier hardforks

## v5.3.0

-   added iExec enterprise
