// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployments, ethers } from 'hardhat';
import deploy from '../../deploy/0_deploy';
import deployEns from '../../deploy/1_deploy-ens';
import { IexecInterfaceNative__factory, IexecInterfaceToken__factory } from '../../typechain';
import config from '../../utils/config';
import { getIexecAccounts } from '../../utils/poco-tools';

async function deployAll() {
    await deploy();
    await deployEns();
    return (await deployments.get('ERC1538Proxy')).address;
}

async function setUpLocalFork() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const proxyAddress = config.getChainConfig(chainId).v5.ERC1538Proxy;
    if (!proxyAddress) {
        throw new Error('ERC1538Proxy is required');
    }
    // Send RLCs to default accounts
    const srlcRichSigner = await ethers.getImpersonatedSigner(proxyAddress);
    const otherAccountInitAmount =
        10 * // Give this much RLC per account
        10 ** 9;
    const accounts = await getIexecAccounts();
    const accountsArray = Object.values(accounts) as SignerWithAddress[];
    console.log(`Rich account ${srlcRichSigner.address} sending RLCs to other accounts..`);
    const iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, ethers.provider);
    for (let i = 0; i < accountsArray.length; i++) {
        const account = accountsArray[i];
        await iexecPoco
            .connect(srlcRichSigner)
            .transfer(account.address, otherAccountInitAmount)
            .then((tx) => tx.wait());
        const balance = await iexecPoco.balanceOf(account.address);
        console.log(`Account #${i}: ${account.address} (${balance.toLocaleString()} nRLC)`);
    }
    // Transfer ownership from Timelock to iexecAdmin EOA account
    const timelockAddress = await iexecPoco.owner();
    const timelock = await ethers.getImpersonatedSigner(timelockAddress);
    const newIexecAdminAddress = accounts.iexecAdmin.address;
    console.log(
        `Transferring Poco ownership from Timelock:${timelockAddress} to iexecAdmin:${newIexecAdminAddress}`,
    );
    await iexecPoco
        .connect(timelock)
        .transferOwnership(newIexecAdminAddress)
        .then((tx) => tx.wait());
    return proxyAddress;
}

async function setUpLocalForkInTokenMode() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const chainConfig = config.getChainConfig(chainId);
    const rlcTokenAddress = chainConfig.token;
    const richmanAddress = chainConfig.richman;
    const accounts = await getIexecAccounts();
    if (rlcTokenAddress && richmanAddress) {
        const rlcToken = IexecInterfaceToken__factory.connect(rlcTokenAddress, ethers.provider);
        const richmanSigner = await ethers.getImpersonatedSigner(richmanAddress);
        await ethers.provider.send('hardhat_setBalance', [
            richmanAddress,
            '0x1000000000000000000', // 1 ETH
        ]);
        const otherAccountInitAmount = 10000 * 10 ** 9;
        const accountsArray = Object.values(accounts) as SignerWithAddress[];
        console.log(`Rich account ${richmanAddress} sending RLCs to other accounts..`);

        // Transfer RLC tokens to all accounts
        for (let i = 0; i < accountsArray.length; i++) {
            const account = accountsArray[i];
            await rlcToken
                .connect(richmanSigner)
                .transfer(account.address, otherAccountInitAmount)
                .then((tx) => tx.wait());
            const balance = await rlcToken.balanceOf(account.address);
            console.log(`Account #${i}: ${account.address} (${balance.toLocaleString()} nRLC)`);
        }
    }

    const proxyAddress = chainConfig.v5.ERC1538Proxy;
    if (proxyAddress) {
        console.log(`Using existing ERC1538Proxy at ${proxyAddress}`);
        const iexecPoco = IexecInterfaceToken__factory.connect(proxyAddress, ethers.provider);
        const timelockAddress = await iexecPoco.owner();
        const timelock = await ethers.getImpersonatedSigner(timelockAddress);
        const newIexecAdminAddress = accounts.iexecAdmin.address;
        console.log(
            `Transferring Poco ownership from Timelock:${timelockAddress} to iexecAdmin:${newIexecAdminAddress}`,
        );

        await iexecPoco
            .connect(timelock)
            .transferOwnership(newIexecAdminAddress)
            .then((tx) => tx.wait());

        return proxyAddress;
    } else {
        console.log('No existing ERC1538Proxy found, deploying new contracts');
        // Deploy all contracts
        await deploy();
        await deployEns();
        const newProxyAddress = (await deployments.get('ERC1538Proxy')).address;
        console.log(`Deployed new ERC1538Proxy at ${newProxyAddress}`);
        return newProxyAddress;
    }
}

/**
 * @returns proxy address.
 */
export const loadHardhatFixtureDeployment = async () => {
    if (process.env.LOCAL_FORK == 'true') {
        return await loadFixture(setUpLocalFork);
    }
    if (process.env.FUJI_FORK == 'true' || process.env.ARBITRUM_SEPOLIA_FORK == 'true') {
        return await loadFixture(setUpLocalForkInTokenMode);
    }
    return await loadFixture(deployAll);
};
