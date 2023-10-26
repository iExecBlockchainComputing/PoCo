# Changelog

## vNEXT
- Migrate to Hardhat:
    - Init Hardhat project. (#134)
    - Migrate unit tests with `@nomiclabs/hardhat-truffle5`. (#135)
    - Fetch `@iexec/solidity@0.1.1` from default public registry. (#136 #137)
    - Migrate tests coverage with [solidity-coverage](https://github.com/sc-forks/solidity-coverage) of `@nomicfoundation/hardhat-toolbox`. (#155)
- Update documentation:
    - Generate class diagrams from solidity contracts. (#139)
    - Add task and contribution state diagrams. (#144)
    - Add boost workflow sequence diagram. Update nominal workflow sequence diagram. (#142)
    - Update TEE workflow sequence diagram. (#147)
    - Update actors diagram. (#148)
    - Rename UMLs.md file to standard README.md. (#150)
- Add `Store` contract compatible with solidity `^0.8.0`. (#138 #154)
- Add Boost module. (#149 #151 #153)
    - Add interfaces. (#156)   
- Upgrade `hashStruct` function to use `ethers`. (#157)
- Deploy Nominal and Boost modules with Hardhat. (#158)
- Publish coverage report on CI/CD. Refactor Jenkinsfile. (#160, #199)
- Init Boost deal structure. (#161)
- Upgrade `eth_signTypedData` function to use `ethers`. Remove now useless `eth-sig-util`. (#163)
- Run automatically before commit a prettier on `.ts` and `.sol` staged files. (#162)
- Clean files related to docker build of a test blockchain. (#164, #165)
- Migrate `IexecPocoBoost` linking to hardhat deploy script. (#166)
- Update prettier rules and reformat. (#167, #168, #169, #170)
- Implement `matchOrdersBoost`:
    - Verify compatibility of orders
        - trust (#171, #227)
        - category (#172)
        - price (175)
        - tag (#187)
        - restrictions (#189, #190)
            - Assets or requester belong to groups in ERC734 identity contract. (#226, #229)
    - Verify entries are registered & category exists. (#193)
    - Verify signatures or presignatures of orders. (#185, #186, #191, #192)
            - ERC1271 contracts can be signers of orders. (#231)
    - Compute volume & consume orders. (#194)
    - Lock requester deal value. (#196)
    - Store deal. (#174)
    - Emit events. (#182, #184, #197)
    - Lock scheduler stake. (#202)
    - Return `dealId`. (#236)
    - Reduce gas footprint:
        - Remove beneficiary from deal storage. (#205)
        - Reduce Boost deal storage from 6 to 5 slots. (#216)
        - Reduce gas consumption on `lock()` calls. (#223)
        - Cache addresses of assets and requester from arguments. (#224)
        - Init local vars and cache order category. (#225)
        - Optimize deal storing by slot. (#228)
        - Change local structure for local variables. (#232)
        - Store in variable if read multiple times. (#233)
        - Group `hasDataset` block. (#234)
- Implement `pushResultBoost`:
    - Verify task exists. (#219)
    - Push result before deadline. (#195)
    - Require enclave challenge when TEE bit of tag set. (#197)
    - Verify signatures
        - scheduler (#173)
        - enclave (#176)
        - tee broker (#235)
    - Reward worker. (#203)
    - Reward app provider. (#204)
    - Reward dataset provider. (#207)
    - Unlock scheduler stake. (#212)
    - Reward scheduler. (#217)
    - Handle callback. (#183, #208)
- Implement `claimBoost`:
    - Refund requester. (#198, #201)
    - Seize workerpool and reward kitty. (#218)
- Documentation:
    - Add inline solidity documentation. (#251, #252, #259)
    - Update class diagrams. (#257)
- Add dedicated Poco Boost accessors. (#206)
- Refactor tests. (#177, #178, #179, #181, #188, #200, #209, #210, #211, #221, #243)
- Add mocha to use test explorer. (#180)
- Reformat contracts. (#222, #237)
- Reformat tests. (#238, #239, #241)
- Check balance in transfer operation (#230)
- Bump dependencies. (#240, #242)
- Clean poco-chain files. (#246)
- Remove patched test helpers. (#249)
- Fix prettier solidity plugin resolution. (#250)
- Use a single 0.8.19 solidity version to compile latest contracts. (#255)
- Compile latest contracts with 0.8.20. (#258)
- Introduce zx for task scripting. (#256)
- Migrate puml2links.sh to zx. (#260)

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
