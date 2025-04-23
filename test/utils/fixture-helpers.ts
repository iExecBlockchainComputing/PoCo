// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { deployments, ethers } from 'hardhat';
import {
    AppRegistry__factory,
    DatasetRegistry__factory,
    ERC1538Proxy__factory,
    IexecInterfaceNative__factory,
    IexecInterfaceToken__factory,
    RLC__factory,
    Registry__factory,
    WorkerpoolRegistry__factory,
} from '../../typechain';
import { getIexecAccounts } from '../../utils/poco-tools';

/**
 * Funds accounts with tokens
 */
export async function fundAccounts(
    tokenAddress: string,
    richmanAddress: string,
    isNativeMode: boolean,
) {
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

/**
 * Transfers ownership of all contracts
 */
export async function transferAllOwnerships(chainConfig: any) {
    if (chainConfig.v5) {
        const registries = [
            { name: 'AppRegistry', address: chainConfig.v5.AppRegistry },
            { name: 'DatasetRegistry', address: chainConfig.v5.DatasetRegistry },
            { name: 'WorkerpoolRegistry', address: chainConfig.v5.WorkerpoolRegistry },
        ];
        for (const registry of registries) {
            if (registry.address) {
                await transferRegistryOwnership(registry.name, registry.address);
            }
        }
        if (chainConfig.v5.ERC1538Proxy) {
            await transferProxyOwnership(chainConfig.v5.ERC1538Proxy);
        }
    }
}

/**
 * Transfers ownership of a registry
 */
export async function transferRegistryOwnership(registryName: string, registryAddress: string) {
    const accounts = await getIexecAccounts();
    const newIexecAdminAddress = accounts.iexecAdmin.address;
    try {
        const registry = Registry__factory.connect(registryAddress, ethers.provider);
        const currentOwner = await registry.owner();
        if (currentOwner.toLowerCase() !== newIexecAdminAddress.toLowerCase()) {
            console.log(
                `Transferring ${registryName} ownership from ${currentOwner} to iexecAdmin: ${newIexecAdminAddress}`,
            );
            const ownerSigner = await ethers.getImpersonatedSigner(currentOwner);
            await registry
                .connect(ownerSigner)
                .transferOwnership(newIexecAdminAddress)
                .then((tx: any) => tx.wait());
        } else {
            console.log(`${registryName} already owned by iexecAdmin`);
        }
    } catch (error) {
        console.error(`Error transferring ownership of ${registryName}:`, error);
    }
}

/**
 * Transfers ownership of the proxy
 */
export async function transferProxyOwnership(proxyAddress: string) {
    const accounts = await getIexecAccounts();
    const iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, ethers.provider);
    const pocoOwner = await iexecPoco.owner();
    const newIexecAdminAddress = accounts.iexecAdmin.address;

    if (pocoOwner.toLowerCase() !== newIexecAdminAddress.toLowerCase()) {
        console.log(
            `Transferring Poco ownership from current owner: ${pocoOwner} to iexecAdmin: ${newIexecAdminAddress}`,
        );
        const pocoOwnerSigner = await ethers.getImpersonatedSigner(pocoOwner);
        await iexecPoco
            .connect(pocoOwnerSigner)
            .transferOwnership(newIexecAdminAddress)
            .then((tx) => tx.wait());
    } else {
        console.log(`Proxy already owned by iexecAdmin`);
    }
}

/**
 * Saves contract information to deployments
 */
export async function saveToDeployments(name: string, factory: any, address: string) {
    await deployments.save(name, {
        abi: (factory as any).constructor.abi,
        address: address,
        bytecode: factory.bytecode,
        deployedBytecode: await ethers.provider.getCode(address),
    });
    console.log(`Saved existing ${name} at ${address} to deployments`);
}

/**
 * Saves all existing contracts to deployments
 */
export async function saveExistingContractsToDeployments(chainConfig: any) {
    if (chainConfig.token) {
        await saveToDeployments('RLC', new RLC__factory(), chainConfig.token);
    }
    if (chainConfig.v5) {
        const contracts = [
            {
                name: 'AppRegistry',
                factory: new AppRegistry__factory(),
                address: chainConfig.v5.AppRegistry,
            },
            {
                name: 'DatasetRegistry',
                factory: new DatasetRegistry__factory(),
                address: chainConfig.v5.DatasetRegistry,
            },
            {
                name: 'WorkerpoolRegistry',
                factory: new WorkerpoolRegistry__factory(),
                address: chainConfig.v5.WorkerpoolRegistry,
            },
            {
                name: 'ERC1538Proxy',
                factory: new ERC1538Proxy__factory(),
                address: chainConfig.v5.ERC1538Proxy,
            },
        ];

        for (const contract of contracts) {
            if (contract.address) {
                await saveToDeployments(contract.name, contract.factory, contract.address);
            }
        }
    }
}
