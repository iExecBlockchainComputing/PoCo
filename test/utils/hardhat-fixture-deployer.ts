// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployments, ethers } from 'hardhat';
import deploy from '../../deploy/0_deploy';
import deployEns from '../../deploy/1_deploy-ens';
import { RLC__factory } from '../../typechain';
import config from '../../utils/config';
import { fundAccounts, saveToDeployments, transferAllOwnerships } from './fixture-helpers';

/**
 * Deploys all contracts from scratch
 * @returns proxy address
 */
async function deployAll() {
    await deploy();
    await deployEns();
    return (await deployments.get('ERC1538Proxy')).address;
}

/**
 * Sets up local fork in native mode
 * @returns proxy address
 */
async function setUpLocalForkInNativeMode() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const proxyAddress = config.getChainConfig(chainId).v5.ERC1538Proxy;
    if (!proxyAddress) {
        throw new Error('ERC1538Proxy is required');
    }
    await fundAccounts(proxyAddress, proxyAddress, true);
    await transferAllOwnerships(config.getChainConfig(chainId));

    return proxyAddress;
}

/**
 * Sets up local fork in token mode
 * @returns proxy address
 */
async function setUpLocalForkInTokenMode() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const chainConfig = config.getChainConfig(chainId);
    if (chainConfig.token) {
        await saveToDeployments('RLC', new RLC__factory(), chainConfig.token);
    }
    if (chainConfig.token && chainConfig.richman) {
        await fundAccounts(chainConfig.token, chainConfig.richman, false);
    }
    await transferAllOwnerships(chainConfig);

    const proxyAddress = chainConfig.v5.ERC1538Proxy;
    if (proxyAddress) {
        console.log(`Using existing ERC1538Proxy at ${proxyAddress}`);
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
 * Loads the appropriate fixture based on environment variables
 * @returns proxy address
 */
export const loadHardhatFixtureDeployment = async () => {
    if (process.env.LOCAL_FORK == 'true') {
        return await loadFixture(setUpLocalForkInNativeMode);
    }
    if (process.env.FUJI_FORK == 'true' || process.env.ARBITRUM_SEPOLIA_FORK == 'true') {
        return await loadFixture(setUpLocalForkInTokenMode);
    }
    return await loadFixture(deployAll);
};
