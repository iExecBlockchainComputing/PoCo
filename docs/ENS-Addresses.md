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
- `apps.v5.iexec.eth` - App registry contract
- `datasets.v5.iexec.eth` - Dataset registry contract
- `workerpools.v5.iexec.eth` - Workerpool registry contract