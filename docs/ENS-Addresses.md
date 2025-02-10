# ENS Addresses in iExec PoCo

This document describes the ENS (Ethereum Name Service) addresses used in the iExec Protocol.

## Domain Structure

The iExec protocol uses the following ENS domain hierarchy:
- Root domain: `iexec.eth`
- Protocol version domain: `v5.iexec.eth`
- User domain: `users.iexec.eth`
- Resource domains:
  - `apps.iexec.eth`
  - `datasets.iexec.eth`
  - `pools.iexec.eth`

## Core Protocol Addresses

The following ENS names are registered for core protocol components:

- `admin.iexec.eth` - Protocol administrator address
- `rlc.iexec.eth` - RLC token contract address
- `core.v5.iexec.eth` - Core protocol proxy (ERC1538Proxy)
  - `0x3eca1B216A7DF1C7689aEb259fFB83ADFB894E7f`
- `apps.v5.iexec.eth` - App registry contract
  - `0xB1C52075b276f87b1834919167312221d50c9D16`
- `datasets.v5.iexec.eth` - Dataset registry contract
  - `0x799DAa22654128d0C64d5b79eac9283008158730`
- `workerpools.v5.iexec.eth` - Workerpool registry contract
  - `0xC76A18c78B7e530A165c5683CB1aB134E21938B4`

To get more details, see [1_deploy-ens.ts script](../deploy/1_deploy-ens.ts).  
