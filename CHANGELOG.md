# Changelog

## v5.5.0
- Migrate to Hardhat:
    - Init Hardhat project. (#134)
    - Migrate unit tests with `@nomiclabs/hardhat-truffle5`. (#135)
    - Fetch `@iexec/solidity@0.1.1` from default public registry. (#136 #137)

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
