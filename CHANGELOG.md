# Changelog

## vNEXT
- Resolve naming conflict in accessors. (#81)
- Refund sponsor on `claimBoost`. (#80)
- Seize sponsor on success task. (#79)
- Refund sponsor on `claim`. (#77)
- Sponsor match orders boost. (#67, #78)
- Start migration to hardhat tests:
    - `finalize` (#79)
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
