// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployments, ethers } from 'hardhat';
import deploy from '../../deploy/0_deploy';
import deployEns from '../../deploy/1_deploy-ens';
import {
    AppRegistry__factory,
    DatasetRegistry__factory,
    ERC1538Proxy__factory,
    IexecInterfaceNative__factory,
    IexecInterfaceToken__factory,
    RLC__factory,
    WorkerpoolRegistry__factory,
} from '../../typechain';
import config from '../../utils/config';
import { getIexecAccounts } from '../../utils/poco-tools';

async function deployAll() {
    await deploy();
    await deployEns();
    return (await deployments.get('ERC1538Proxy')).address;
}

async function transferProxyOwnership(proxyAddress: string) {
    const accounts = await getIexecAccounts();
    const iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, ethers.provider);
    const pocoOwner = await iexecPoco.owner();
    const pocoOwnerSigner = await ethers.getImpersonatedSigner(pocoOwner);
    const newIexecAdminAddress = accounts.iexecAdmin.address;
    console.log(
        `Transferring Poco ownership from current owner: ${pocoOwner} to iexecAdmin: ${newIexecAdminAddress}`,
    );
    await iexecPoco
        .connect(pocoOwnerSigner)
        .transferOwnership(newIexecAdminAddress)
        .then((tx) => tx.wait());
}

async function fundAccounts(tokenAddress: string, richmanAddress: string, isNativeMode: boolean) {
    const accounts = await getIexecAccounts();
    const otherAccountInitAmount = isNativeMode ? 10 * 10 ** 9 : 10000 * 10 ** 9;
    const accountsArray = Object.values(accounts) as SignerWithAddress[];
    if (!isNativeMode) {
        await ethers.provider.send('hardhat_setBalance', [
            richmanAddress,
            '0x1000000000000000000', // 1 ETH
        ]);
    }
    console.log(`Rich account ${richmanAddress} sending RLCs to other accounts..`);
    const richmanSigner = await ethers.getImpersonatedSigner(richmanAddress);
    const tokenContract = isNativeMode
        ? IexecInterfaceNative__factory.connect(tokenAddress, ethers.provider)
        : IexecInterfaceToken__factory.connect(tokenAddress, ethers.provider);
    for (let i = 0; i < accountsArray.length; i++) {
        const account = accountsArray[i];
        await tokenContract
            .connect(richmanSigner)
            .transfer(account.address, otherAccountInitAmount)
            .then((tx) => tx.wait());

        const balance = await tokenContract.balanceOf(account.address);
        console.log(`Account #${i}: ${account.address} (${balance.toLocaleString()} nRLC)`);
    }
}

async function setUpLocalForkInNativeMode() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const proxyAddress = config.getChainConfig(chainId).v5.ERC1538Proxy;
    if (!proxyAddress) {
        throw new Error('ERC1538Proxy is required');
    }
    await fundAccounts(proxyAddress, proxyAddress, true);
    await transferProxyOwnership(proxyAddress);

    return proxyAddress;
}

async function setUpLocalForkInTokenMode() {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const chainConfig = config.getChainConfig(chainId);
    if (chainConfig.token) {
        await saveToDeployments('RLC', new RLC__factory(), chainConfig.token);

        if (chainConfig.richman) {
            await fundAccounts(chainConfig.token, chainConfig.richman, false);
        }
    }
    if (chainConfig.v5) {
        if (chainConfig.v5.AppRegistry) {
            await saveToDeployments(
                'AppRegistry',
                new AppRegistry__factory(),
                chainConfig.v5.AppRegistry,
            );
        }
        if (chainConfig.v5.DatasetRegistry) {
            await saveToDeployments(
                'DatasetRegistry',
                new DatasetRegistry__factory(),
                chainConfig.v5.DatasetRegistry,
            );
        }
        if (chainConfig.v5.WorkerpoolRegistry) {
            await saveToDeployments(
                'WorkerpoolRegistry',
                new WorkerpoolRegistry__factory(),
                chainConfig.v5.WorkerpoolRegistry,
            );
        }
        if (chainConfig.v5.ERC1538Proxy) {
            await saveToDeployments(
                'ERC1538Proxy',
                new ERC1538Proxy__factory(),
                chainConfig.v5.ERC1538Proxy,
            );
        }
    }

    const proxyAddress = chainConfig.v5.ERC1538Proxy;
    if (proxyAddress) {
        console.log(`Using existing ERC1538Proxy at ${proxyAddress}`);
        await transferProxyOwnership(proxyAddress);
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
        return await loadFixture(setUpLocalForkInNativeMode);
    }
    if (process.env.FUJI_FORK == 'true' || process.env.ARBITRUM_SEPOLIA_FORK == 'true') {
        return await loadFixture(setUpLocalForkInTokenMode);
    }
    return await loadFixture(deployAll);
};

async function saveToDeployments(name: string, factory: any, address: string) {
    await deployments.save(name, {
        abi: (factory as any).constructor.abi,
        address: address,
        bytecode: factory.bytecode,
        deployedBytecode: await ethers.provider.getCode(address),
    });
    console.log(`Saved existing ${name} at ${address} to deployments`);
}
