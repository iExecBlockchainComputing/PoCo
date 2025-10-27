// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';
import config from '../../utils/config';
import { getTestAccounts } from './extract-diamond-storage';

/**
 * Verify that registries are still intact after state reset
 */
async function verifyRegistries() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const chainConfig = config.getChainConfig(chainId);
    const diamondProxyAddress = chainConfig.v5.DiamondProxy;

    if (!diamondProxyAddress) {
        throw new Error('DiamondProxy address not found in config');
    }

    console.log('📊 Verifying registries after state reset...\n');
    console.log(`Diamond proxy: ${diamondProxyAddress}`);
    console.log(`Chain ID: ${chainId}\n`);

    const iexec = await ethers.getContractAt('IexecInterfaceToken', diamondProxyAddress);

    // Check registries
    const appRegistry = await iexec.appregistry();
    const datasetRegistry = await iexec.datasetregistry();
    const workerpoolRegistry = await iexec.workerpoolregistry();

    console.log('Registry addresses:');
    console.log(`  App Registry:        ${appRegistry}`);
    console.log(`  Dataset Registry:    ${datasetRegistry}`);
    console.log(`  Workerpool Registry: ${workerpoolRegistry}\n`);

    // Check token info
    const name = await iexec.name();
    const symbol = await iexec.symbol();
    const decimals = await iexec.decimals();

    console.log('Token metadata:');
    console.log(`  Name:     ${name}`);
    console.log(`  Symbol:   ${symbol}`);
    console.log(`  Decimals: ${decimals}\n`);

    // Check user state
    const totalSupply = await iexec.totalSupply();
    const callbackGas = await iexec.callbackgas();

    console.log('User state (should be reset):');
    console.log(`  Total Supply:  ${totalSupply.toString()}`);
    console.log(`  Callback Gas:  ${callbackGas.toString()}\n`);

    // Check individual account balances
    console.log('Individual account balances (should be zero):');
    const testAccounts = await getTestAccounts();
    const accountsToCheck = [...testAccounts.slice(0, 5), diamondProxyAddress]; // Check first 5 + proxy

    let allBalancesZero = true;
    for (const account of accountsToCheck) {
        const balance = await iexec.balanceOf(account);
        const frozen = await iexec.frozenOf(account);
        const displayAddress =
            account === diamondProxyAddress ? 'DiamondProxy' : account.slice(0, 10) + '...';

        if (balance !== 0n || frozen !== 0n) {
            console.log(
                `  ❌ ${displayAddress}: balance=${balance.toString()}, frozen=${frozen.toString()}`,
            );
            allBalancesZero = false;
        }
    }

    if (allBalancesZero) {
        console.log(
            `  ✅ All ${accountsToCheck.length} sampled accounts have zero balance/frozen\n`,
        );
    } else {
        console.log(`  ⚠️  Some accounts still have non-zero balances\n`);
    }

    // Verify
    const allGood =
        appRegistry !== ethers.ZeroAddress &&
        datasetRegistry !== ethers.ZeroAddress &&
        workerpoolRegistry !== ethers.ZeroAddress &&
        name !== '' &&
        symbol !== '' &&
        decimals > 0 &&
        totalSupply.toString() === '0' &&
        allBalancesZero;

    if (allGood) {
        console.log('✅ All checks passed!');
        console.log('   - Registries preserved');
        console.log('   - Token metadata preserved');
        console.log('   - User state reset to zero');
        console.log('   - Individual account balances reset to zero');
    } else {
        console.log('❌ Some checks failed!');
        if (appRegistry === ethers.ZeroAddress) console.log('   - App registry was reset to zero');
        if (datasetRegistry === ethers.ZeroAddress)
            console.log('   - Dataset registry was reset to zero');
        if (workerpoolRegistry === ethers.ZeroAddress)
            console.log('   - Workerpool registry was reset to zero');
        if (name === '') console.log('   - Token name was reset');
        if (symbol === '') console.log('   - Token symbol was reset');
        if (decimals === 0) console.log('   - Token decimals was reset');
        if (totalSupply.toString() !== '0')
            console.log(`   - Total supply not zero: ${totalSupply.toString()}`);
        if (!allBalancesZero) console.log('   - Some individual account balances are not zero');
    }
}

verifyRegistries()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
