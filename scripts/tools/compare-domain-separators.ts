// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';
import config from '../../utils/config';

async function compareDomainSeparators() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const chainConfig = config.getChainConfig(chainId);
    const diamondProxyAddress = chainConfig.v5.DiamondProxy;

    console.log('\n🔍 Comparing Domain Separator Calculations...\n');
    console.log(`Chain ID: ${chainId}`);
    console.log(`Diamond Proxy: ${diamondProxyAddress}\n`);

    const iexec = await ethers.getContractAt('IexecInterfaceToken', diamondProxyAddress);

    // Get current from contract
    const currentDomainSeparator = await iexec.eip712domain_separator();
    console.log('📍 Current (from contract):', currentDomainSeparator);

    // Calculate what PRODUCTION has (Staked RLC, 0x5f)
    const productionDomain = {
        name: 'Staked RLC',
        version: '0x5f',
        chainId: chainId,
        verifyingContract: diamondProxyAddress,
    };

    const productionSeparator = ethers.TypedDataEncoder.hashDomain(productionDomain);
    console.log('\n📍 Production domain (Staked RLC, 0x5f):');
    console.log('   Calculated:', productionSeparator);
    console.log('   Match:', productionSeparator === currentDomainSeparator ? '✅' : '❌');

    // Calculate what TESTS expect (iExecODB, 5.0.0)
    const testDomain = {
        name: 'iExecODB',
        version: '5.0.0',
        chainId: chainId,
        verifyingContract: diamondProxyAddress,
    };

    const testSeparator = ethers.TypedDataEncoder.hashDomain(testDomain);
    console.log('\n📍 Test domain (iExecODB, 5.0.0):');
    console.log('   Calculated:', testSeparator);
    console.log('   Match:', testSeparator === currentDomainSeparator ? '✅' : '❌');

    console.log('\n' + '='.repeat(80));
    if (testSeparator === currentDomainSeparator) {
        console.log('✅ Contract domain matches TEST expectations - signatures will work!');
    } else if (productionSeparator === currentDomainSeparator) {
        console.log('⚠️  Contract domain matches PRODUCTION - test signatures will FAIL!');
        console.log('    Need to reset domain separator to test values.');
    } else {
        console.log('❓ Contract domain matches neither - unexpected state!');
    }
    console.log('='.repeat(80) + '\n');
}

compareDomainSeparators()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
