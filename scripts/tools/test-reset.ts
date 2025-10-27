// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';
import config from '../../utils/config';
import { getTestAccounts } from './extract-diamond-storage';
import { resetPocoStateAfterUpgrade } from './reset-poco-state-after-upgrade';

/**
 * Test script to run reset and verify in the same process (same fork state)
 */
async function testReset() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const chainConfig = config.getChainConfig(chainId);
    const diamondProxyAddress = chainConfig.v5.DiamondProxy;

    if (!diamondProxyAddress) {
        throw new Error('DiamondProxy address not found in config');
    }

    // Step 1: Check balances BEFORE reset
    console.log('\n📊 BEFORE RESET:\n');
    const iexec = await ethers.getContractAt('IexecInterfaceToken', diamondProxyAddress);

    const totalSupplyBefore = await iexec.totalSupply();
    const proxyBalanceBefore = await iexec.balanceOf(diamondProxyAddress);
    const testAccounts = await getTestAccounts();
    const account0BalanceBefore = await iexec.balanceOf(testAccounts[0]);

    console.log(`  Total Supply:        ${totalSupplyBefore.toString()}`);
    console.log(`  Proxy Balance:       ${proxyBalanceBefore.toString()}`);
    console.log(`  Test Account[0]:     ${account0BalanceBefore.toString()}`);

    // Step 2: Run reset
    console.log('\n🔄 RUNNING RESET...\n');
    await resetPocoStateAfterUpgrade();

    // Step 3: Check balances AFTER reset
    console.log('\n📊 AFTER RESET:\n');

    const totalSupplyAfter = await iexec.totalSupply();
    const proxyBalanceAfter = await iexec.balanceOf(diamondProxyAddress);
    const proxyFrozenAfter = await iexec.frozenOf(diamondProxyAddress);
    const account0BalanceAfter = await iexec.balanceOf(testAccounts[0]);
    const account0FrozenAfter = await iexec.frozenOf(testAccounts[0]);

    console.log(`  Total Supply:        ${totalSupplyAfter.toString()}`);
    console.log(`  Proxy Balance:       ${proxyBalanceAfter.toString()}`);
    console.log(`  Proxy Frozen:        ${proxyFrozenAfter.toString()}`);
    console.log(`  Test Account[0]:     ${account0BalanceAfter.toString()}`);
    console.log(`  Test Account[0] Frz: ${account0FrozenAfter.toString()}`);

    // Verify
    const success =
        totalSupplyAfter === 0n &&
        proxyBalanceAfter === 0n &&
        proxyFrozenAfter === 0n &&
        account0BalanceAfter === 0n &&
        account0FrozenAfter === 0n;

    console.log();
    if (success) {
        console.log('✅ SUCCESS: All balances reset to zero!');
    } else {
        console.log('❌ FAILURE: Some balances not zero!');
        if (totalSupplyAfter !== 0n)
            console.log(`   - Total supply: ${totalSupplyAfter.toString()}`);
        if (proxyBalanceAfter !== 0n)
            console.log(`   - Proxy balance: ${proxyBalanceAfter.toString()}`);
        if (proxyFrozenAfter !== 0n)
            console.log(`   - Proxy frozen: ${proxyFrozenAfter.toString()}`);
        if (account0BalanceAfter !== 0n)
            console.log(`   - Account[0] balance: ${account0BalanceAfter.toString()}`);
        if (account0FrozenAfter !== 0n)
            console.log(`   - Account[0] frozen: ${account0FrozenAfter.toString()}`);
    }
}

testReset()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
