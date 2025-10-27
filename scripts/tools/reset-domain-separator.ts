// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers, network } from 'hardhat';
import config from '../../utils/config';

/**
 * Calculate and set the correct domain separator for tests.
 *
 * Tests expect domain with:
 * - name: 'iExecODB'
 * - version: '5.0.0'
 * - chainId: current network
 * - verifyingContract: DiamondProxy address
 *
 * But production might have different values, causing signature failures.
 */
async function resetDomainSeparator() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const chainConfig = config.getChainConfig(chainId);
    const diamondProxyAddress = chainConfig.v5.DiamondProxy;

    if (!diamondProxyAddress) {
        throw new Error('DiamondProxy address not found in config');
    }

    console.log('\n🔐 Resetting EIP-712 Domain Separator...');
    console.log(`Chain ID: ${chainId}`);
    console.log(`Diamond Proxy: ${diamondProxyAddress}\n`);

    // Calculate expected domain separator for tests
    // Tests use: name='iExecODB', version='5.0.0'
    const expectedDomain = {
        name: 'iExecODB',
        version: '5.0.0',
        chainId: chainId,
        verifyingContract: diamondProxyAddress,
    }; // Calculate domain separator hash using ethers v6 TypedDataEncoder
    const expectedDomainSeparator = ethers.TypedDataEncoder.hashDomain(expectedDomain);

    console.log('Expected domain separator:', expectedDomainSeparator);
    console.log('Domain parameters:');
    console.log(`  name: ${expectedDomain.name}`);
    console.log(`  version: ${expectedDomain.version}`);
    console.log(`  chainId: ${expectedDomain.chainId}`);
    console.log(`  verifyingContract: ${expectedDomain.verifyingContract}`);

    // Get current domain separator from contract
    const iexec = await ethers.getContractAt('IexecInterfaceToken', diamondProxyAddress);
    const currentDomainSeparator = await iexec.eip712domain_separator();

    console.log('Current domain separator:', currentDomainSeparator);

    if (currentDomainSeparator === expectedDomainSeparator) {
        console.log('✅ Domain separator already matches test expectations!\n');
        return;
    }

    console.log('⚠️  Domain separator mismatch, resetting...\n');

    // Calculate storage slot for m_eip712DomainSeparator
    // From PocoStorageLib.v8.sol: it's at offset 11 in PocoStorage
    const POCO_STORAGE_LOCATION =
        '0x5862653c6982c162832160cf30593645e8487b257e44d77cdd6b51eee2651b00';
    const domainSeparatorSlot = ethers.toBeHex(BigInt(POCO_STORAGE_LOCATION) + BigInt(11), 32);

    console.log(`Setting domain separator at slot: ${domainSeparatorSlot}`);

    // Set the storage value
    await network.provider.send('hardhat_setStorageAt', [
        diamondProxyAddress,
        domainSeparatorSlot,
        expectedDomainSeparator,
    ]);

    // Mine a block to apply changes
    await network.provider.send('evm_mine', []);

    // Verify
    const newDomainSeparator = await iexec.eip712domain_separator();
    console.log(`New domain separator: ${newDomainSeparator}`);

    if (newDomainSeparator === expectedDomainSeparator) {
        console.log('✅ Domain separator successfully reset!\n');
    } else {
        console.log('❌ Domain separator reset failed!\n');
        throw new Error('Domain separator mismatch after reset');
    }
}

// Export for use in other scripts
export { resetDomainSeparator };

// Run if called directly
if (require.main === module) {
    resetDomainSeparator()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
