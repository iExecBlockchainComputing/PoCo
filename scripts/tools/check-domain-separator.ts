// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';
import config from '../../utils/config';

async function checkDomainSeparator() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const chainConfig = config.getChainConfig(chainId);
    const diamondProxyAddress = chainConfig.v5.DiamondProxy;

    console.log('\n📋 Checking EIP-712 Domain Separator...\n');
    console.log(`Chain ID: ${chainId}`);
    console.log(`Diamond Proxy: ${diamondProxyAddress}\n`);

    const iexec = await ethers.getContractAt('IexecInterfaceToken', diamondProxyAddress);

    // Get the current domain separator from the contract
    const currentDomainSep = await iexec.eip712domain_separator();
    console.log(`Current domain separator: ${currentDomainSep}`);

    // Calculate what the domain separator SHOULD be for this chain
    const name = await iexec.name();
    const version = '0x5f'; // IexecLibCore_v5.APP_VERSION

    // EIP-712 domain struct
    const domain = {
        name: name,
        version: version,
        chainId: chainId,
        verifyingContract: diamondProxyAddress,
    };

    console.log(`\nDomain parameters:`);
    console.log(`  name: ${name}`);
    console.log(`  version: ${version}`);
    console.log(`  chainId: ${chainId}`);
    console.log(`  verifyingContract: ${diamondProxyAddress}`);

    // Calculate expected domain separator
    const domainTypeHash = ethers.id(
        'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
    );
    const nameHash = ethers.id(name);
    const versionHash = ethers.id(version);

    const expected = ethers.keccak256(
        ethers.concat([
            domainTypeHash,
            nameHash,
            versionHash,
            ethers.zeroPadValue(ethers.toBeHex(chainId), 32),
            ethers.zeroPadValue(diamondProxyAddress, 32),
        ]),
    );

    console.log(`\nExpected domain separator: ${expected}`);
    console.log(`Match: ${currentDomainSep === expected ? '✅ YES' : '❌ NO'}`);

    if (currentDomainSep !== expected) {
        console.log('\n⚠️  MISMATCH DETECTED!');
        console.log('This means signatures created with the expected domain will fail!');
        console.log('\nPossible causes:');
        console.log('  1. Contract was deployed on different chainId');
        console.log('  2. Contract name/version changed');
        console.log('  3. Domain separator was manually updated');
    }
}

checkDomainSeparator()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
