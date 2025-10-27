// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';

/**
 * Extracts storage information from a Diamond contract using DiamondLoupe.
 *
 * This function:
 * 1. Uses DiamondLoupe to enumerate all facets
 * 2. Identifies the storage slots used by PoCo contracts
 * 3. Returns a list of slots that need to be reset
 *
 * Diamond storage pattern (ERC-2535):
 * - Each facet can have its own namespaced storage
 * - Common pattern: keccak256("namespace.string") - 1
 * - PoCo uses AppStorage pattern shared across facets
 */

/**
 * Calculate storage slot for a mapping entry.
 * In Solidity: keccak256(abi.encode(key, baseSlot))
 */
export function calculateMappingSlot(address: string, baseSlot: string): string {
    // Ensure address is properly formatted (32 bytes)
    const paddedAddress = ethers.zeroPadValue(address, 32);
    // Encode: abi.encode(address, baseSlot)
    const encoded = ethers.concat([paddedAddress, baseSlot]);
    // Hash: keccak256(...)
    return ethers.keccak256(encoded);
}

/**
 * Get Hardhat test account addresses.
 */
export async function getTestAccounts(): Promise<string[]> {
    const signers = await ethers.getSigners();
    // Take first 16 accounts (standard Hardhat accounts)
    return signers.slice(0, 16).map((signer) => signer.address);
}

interface FacetInfo {
    facetAddress: string;
    functionSelectors: string[];
}

interface StorageSlotInfo {
    slot: string;
    description: string;
    namespace?: string;
}

export async function extractDiamondStorage(diamondAddress: string): Promise<StorageSlotInfo[]> {
    console.log('📊 Extracting Diamond storage layout...');
    console.log(`Diamond address: ${diamondAddress}\n`);

    const slotsToReset: StorageSlotInfo[] = [];

    // Get DiamondLoupe interface
    const diamond = await ethers.getContractAt('IDiamondLoupe', diamondAddress);

    // Get all facets
    const facets = await diamond.facets();
    console.log(`Found ${facets.length} facets:\n`);

    for (const facet of facets) {
        console.log(`  ${facet.facetAddress}`);
        console.log(`  Function selectors: ${facet.functionSelectors.length}`);
    }

    console.log('\n📍 Calculating storage slots...\n');

    // Known PoCo storage namespaces (ERC-7201 pattern)
    // From PocoStorageLib.v8.sol:
    // POCO_STORAGE_LOCATION = keccak256(abi.encode(uint256(keccak256("iexec.poco.storage.PocoStorage")) - 1)) & ~bytes32(uint256(0xff))
    const POCO_STORAGE_LOCATION =
        '0x5862653c6982c162832160cf30593645e8487b257e44d77cdd6b51eee2651b00';

    // Diamond standard storage position - DO NOT RESET THIS!
    // This contains the facet mappings and function selectors
    // Resetting it would break the Diamond proxy completely
    const DIAMOND_STORAGE_POSITION = ethers.id('diamond.standard.diamond.storage');

    console.log('  ⚠️  Diamond storage will NOT be reset (contains critical facet mappings)');
    console.log(`  Diamond storage slot: ${DIAMOND_STORAGE_POSITION}\n`);

    console.log(`  PocoStorage namespace: iexec.poco.storage.PocoStorage`);
    console.log(`  PocoStorage base slot: ${POCO_STORAGE_LOCATION}`);
    console.log(`  ⚠️  System config fields will be PRESERVED\n`);

    // Add sequential slots for PocoStorage fields
    // From PocoStorageLib.v8.sol struct PocoStorage:
    //
    // CRITICAL: We only reset USER STATE, not SYSTEM CONFIGURATION
    //
    // Storage layout (actual offsets from PocoStorageLib.v8.sol):
    // 0: m_appregistry
    // 1: m_datasetregistry
    // 2: m_workerpoolregistry
    // 3: m_baseToken
    // 4: m_name
    // 5: m_symbol
    // 6: m_decimals
    // 7: m_totalSupply
    // 8: m_balances (mapping base)
    // 9: m_frozens (mapping base)
    // 10: m_allowances (nested mapping base)
    // 11: m_eip712DomainSeparator ← PRESERVE (needed for signatures!)
    // 12: m_presigned (mapping base)
    // 13: m_consumed (mapping base) ← Reset individual entries, not base
    // 14: m_deals (mapping base)
    // 15: m_tasks (mapping base)
    // 16: m_consensus (mapping base)
    // 17: m_contributions (nested mapping base)
    // 18: m_workerScores (mapping base)
    // 19: m_teebroker
    // 20: m_callbackgas
    // 21: m_categories ← PRESERVE (production categories needed!)
    //
    // DO NOT RESET (system config):
    // - Slots 0-6: Registries and token metadata
    // - Slot 11: m_eip712DomainSeparator (breaks signatures if changed)
    // - Slot 21: m_categories (production categories needed)
    //
    // DO RESET (user state - base slots only):
    // - Slot 7: m_totalSupply
    // - Slots 8-10: mapping bases (m_balances, m_frozens, m_allowances)
    // - Slot 12: m_presigned mapping base
    // - Slots 14-18: task/execution state mapping bases
    // - Slot 19-20: teebroker, callbackgas
    //
    // SPECIAL HANDLING (reset individual entries, not base):
    // - Slot 8: m_balances - reset specific account entries
    // - Slot 9: m_frozens - reset specific account entries
    // - Slot 13: m_consumed - reset specific order hash entries

    const pocoStorageBase = BigInt(POCO_STORAGE_LOCATION);

    const pocoStorageFields = [
        // Skip 0-6 (registries and token metadata - DO NOT RESET)
        { offset: 7, name: 'm_totalSupply' },
        { offset: 8, name: 'm_balances mapping base' },
        { offset: 9, name: 'm_frozens mapping base' },
        { offset: 10, name: 'm_allowances mapping base' },
        // Skip 11 (m_eip712DomainSeparator - DO NOT RESET - breaks signatures!)
        { offset: 12, name: 'm_presigned mapping base' },
        // Skip 13 (m_consumed - will reset individual entries instead)
        { offset: 14, name: 'm_deals mapping base' },
        { offset: 15, name: 'm_tasks mapping base' },
        { offset: 16, name: 'm_consensus mapping base' },
        { offset: 17, name: 'm_contributions mapping base' },
        { offset: 18, name: 'm_workerScores mapping base' },
        { offset: 19, name: 'm_teebroker' },
        { offset: 20, name: 'm_callbackgas' },
        // Skip 21 (m_categories - DO NOT RESET - production categories needed!)
    ];

    console.log('📝 PocoStorage field slots to reset:\n');
    console.log('   ⚠️  Preserving: registries, token metadata, domain separator, categories\n');
    for (const field of pocoStorageFields) {
        const slot = pocoStorageBase + BigInt(field.offset);
        const slotHex = '0x' + slot.toString(16).padStart(64, '0');

        slotsToReset.push({
            slot: slotHex,
            description: `PocoStorage.${field.name}`,
        });

        console.log(`  ${field.name.padEnd(30)} → ${slotHex}`);
    }

    console.log(`\n✅ Found ${slotsToReset.length} storage slots to reset\n`);

    return slotsToReset;
}

// Standalone execution
if (require.main === module) {
    (async () => {
        const config = require('../../utils/config').default;
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const chainConfig = config.getChainConfig(chainId);
        const diamondAddress = chainConfig.v5.DiamondProxy;

        if (!diamondAddress) {
            throw new Error('DiamondProxy address not found in config');
        }

        const slots = await extractDiamondStorage(diamondAddress);

        console.log('\n📋 Summary:');
        console.log(`Total slots to reset: ${slots.length}`);
        console.log('\nSlot details:');
        slots.forEach((s, i) => {
            console.log(`${i + 1}. ${s.description}`);
            console.log(`   ${s.slot}`);
            if (s.namespace) {
                console.log(`   Namespace: ${s.namespace}`);
            }
        });
    })()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
