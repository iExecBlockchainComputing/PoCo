# Changelog

## vNEXT
- Migrate to Hardhat:
    - Init Hardhat project. (#134)
    - Migrate unit tests with `@nomiclabs/hardhat-truffle5`. (#135)
    - Fetch `@iexec/solidity@0.1.1` from default public registry. (#136 #137)
- Update documentation:
    - Generate class diagrams from solidity contracts. (#139)
    - Add task and contribution state diagrams. (#144)
    - Add boost workflow sequence diagram. Update nominal workflow sequence diagram. (#142)
    - Update TEE workflow sequence diagram. (#147)
    - Update actors diagram. (#148)
    - Rename UMLs.md file to standard README.md. (#150)
- Add `Store` contract compatible with solidity `^0.8.0`. (#138)
- Add Boost module. (#149 #151)

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
