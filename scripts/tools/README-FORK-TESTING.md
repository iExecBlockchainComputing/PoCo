# Fork Testing Tools - Quick Reference

This directory contains tools for testing contract upgrades on forked networks with state reset capabilities.

## 🎯 Quick Start

###⚠️ IMPORTANT: Fork State Persistence

**Fork state only persists within a single Hardhat process.** Each `npx hardhat run` creates a fresh fork from the same block. Changes made in one run do **not** carry over to the next.

**Therefore:**
- ✅ **DO**: Run upgrade + reset + test in **one command**
- ❌ **DON'T**: Run reset in one command, then test in another

### Test an Upgrade on Fork (All-in-One)

```bash
# This runs upgrade → reset → test in a SINGLE process
UPGRADE_SCRIPT=v6.1.0-bulk-processing.ts npm run test:arbitrumSepolia
```

### Test an Upgrade Manually (Advanced)

If you need to run steps separately for debugging:

```bash
# 1. Start a persistent Hardhat node with forking
ARBITRUM_SEPOLIA_FORK=true npx hardhat node --network hardhat

# 2. In another terminal, run against the persistent node
ARBITRUM_SEPOLIA_FORK=true npx hardhat run scripts/upgrades/v6.1.0-bulk-processing.ts --network localhost
ARBITRUM_SEPOLIA_FORK=true npx hardhat run scripts/tools/reset-poco-state-after-upgrade.ts --network localhost
ARBITRUM_SEPOLIA_FORK=true npx hardhat test --network localhost
```

## 📁 Available Tools

### `extract-diamond-storage.ts`
Extracts storage layout from Diamond contract using DiamondLoupe interface and ERC-7201 storage locations.

**Usage:**
```bash
ARBITRUM_SEPOLIA_FORK=true npx hardhat run scripts/tools/extract-diamond-storage.ts --network hardhat
```

**Output:**
- Lists all facets and their function selectors
- Shows PocoStorage base slot (0x5862653c6982c162832160cf30593645e8487b257e44d77cdd6b51eee2651b00)
- Calculates slots for all struct fields (m_totalSupply, m_callbackgas, etc.)
- Number of slots to reset (typically 20)

### `reset-poco-state-after-upgrade.ts`
Resets PoCo contract storage to clean state after an upgrade.

**Usage:**
```bash
ARBITRUM_SEPOLIA_FORK=true npx hardhat run scripts/tools/reset-poco-state-after-upgrade.ts --network hardhat
```

**What it does:**
1. Calls `extract-diamond-storage.ts` to get slot list
2. Uses `hardhat_setStorageAt` to zero each slot
3. Verifies totalSupply == 0
4. Leaves Diamond facet mappings intact

**Important:** Must use `--network hardhat` even when forking. The `hardhat_setStorageAt` RPC method is only available on Hardhat's local network.

### `run-upgrade-and-reset.ts`
Orchestrates upgrade execution followed by state reset.

**Usage (standalone):**
```bash
UPGRADE_SCRIPT=v6.1.0-bulk-processing.ts \
ARBITRUM_SEPOLIA_FORK=true \
npx hardhat run scripts/tools/run-upgrade-and-reset.ts --network hardhat
```

**Usage (integrated with tests):**
```bash
# The test fixture automatically detects UPGRADE_SCRIPT and calls this
UPGRADE_SCRIPT=v6.1.0-bulk-processing.ts npm run test:arbitrumSepolia
```

### `get-storage-layout.ts`
Extracts storage layouts from compiled artifacts using @openzeppelin/upgrades-core.

**Usage:**
```bash
npx hardhat run scripts/tools/get-storage-layout.ts
```

**Output:** Storage layouts for all compiled contracts in JSON format.

## ⚠️ Important Notes

###  Always use `--network hardhat`

When using fork environment variables, **always specify `--network hardhat`**, not the actual network name:

```bash
# ✅ CORRECT
ARBITRUM_SEPOLIA_FORK=true npx hardhat run script.ts --network hardhat

# ❌ WRONG - will fail with "hardhat_setStorageAt does not exist"
ARBITRUM_SEPOLIA_FORK=true npx hardhat run script.ts --network arbitrumSepolia
```

**Why?** The fork flag configures the `hardhat` network to fork from the specified chain. Using `--network arbitrumSepolia` connects to the live network, which doesn't support `hardhat_setStorageAt`.

### 🛡️ Diamond Storage is Protected

The reset tools **never** reset Diamond storage (`0xc8fcad8db84d3cc18b4c41d551ea0ee66dd599cde068d998e57d5e09332c131c`). This slot contains the facet-to-function-selector mappings. Resetting it would completely break the Diamond proxy.

### 📦 What Gets Reset

**PocoStorage fields (ERC-7201 namespaced storage):**
- `m_totalSupply` → 0
- `m_callbackgas` → 0
- Registry addresses → 0x0
- String fields (m_name, m_symbol) → empty
- Mapping/array base slots → 0 (makes contents inaccessible)

**What does NOT get reset:**
- Diamond facet mappings
- Individual mapping values (e.g., specific account balances)
- Registry contracts (external contracts)
- Facet contract code

## 🔧 Supported Networks

### Arbitrum Sepolia
```bash
ARBITRUM_SEPOLIA_FORK=true npx hardhat run <script> --network hardhat
# or
npm run test:arbitrumSepolia
```

### Arbitrum Mainnet
```bash
ARBITRUM_FORK=true npx hardhat run <script> --network hardhat
# or
npm run test:arbitrum
```

### Bellecour (iExec native chain)
```bash
LOCAL_FORK=true npx hardhat run <script> --network hardhat
# or
npm run test:bellecour
```

## 🐛 Troubleshooting

### Error: "hardhat_setStorageAt does not exist"
**Cause:** Using `--network <chainName>` instead of `--network hardhat`  
**Fix:** Change to `--network hardhat` and set the appropriate fork flag

### Error: "DiamondProxy address not found in config"
**Cause:** Chain config missing or fork not configured properly  
**Fix:** Check `utils/config.ts` has the chain ID and DiamondProxy address

### Tests still fail after reset
**Debug steps:**
1. Run `npm run storage-to-diagrams` to visualize storage
2. Check if additional slots need resetting in `extract-diamond-storage.ts`
3. Verify test assumptions match reset state

### totalSupply not zero after reset
**Possible causes:**
- Wrong storage slot calculated
- Storage layout changed in upgrade
- Additional storage namespaces exist

**Debug:**
```bash
# Check actual storage layout
npm run check-storage-layout

# Verify slot calculations
ARBITRUM_SEPOLIA_FORK=true npx hardhat run scripts/tools/extract-diamond-storage.ts --network hardhat
```

## 📚 Additional Documentation

- **[FORK_TESTING_GUIDE.md](../../FORK_TESTING_GUIDE.md)** - Complete guide to fork testing workflow
- **[DIAMOND_STORAGE_RESET.md](../../docs/DIAMOND_STORAGE_RESET.md)** - Deep dive into storage reset strategy
- **[ERC-7201](https://eips.ethereum.org/EIPS/eip-7201)** - Namespaced storage layout standard
- **[ERC-2535](https://eips.ethereum.org/EIPS/eip-2535)** - Diamond proxy pattern

## 🚀 GitHub Actions Integration

The deploy workflow supports fork testing with upgrades:

```yaml
workflow_dispatch:
  inputs:
    network: arbitrumSepolia
    dry_run: true
    upgrade_script: v6.1.0-bulk-processing.ts
```

This will:
1. Fork the specified network
2. Run the upgrade script
3. Reset contract state
4. Run the full test suite
5. Report results (no actual deployment)

See `.github/workflows/deploy.yml` for implementation details.
