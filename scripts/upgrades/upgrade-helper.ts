// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import { DiamondCutFacet__factory, Ownable__factory } from '../../typechain';
import { getFunctionSelectors } from '../../utils/proxy-tools';
import { getDeployerAndOwnerSigners } from '../../utils/deploy-tools';
import config, { isArbitrumFork, isArbitrumSepoliaFork } from '../../utils/config';

export type FacetDetails = {
    name: string;
    address: string | null;
    factory: ContractFactory | null;
};

export async function getUpgradeContext() {
    const { chainId, name: networkName } = await ethers.provider.getNetwork();
    console.log(`Network: ${networkName} (${chainId})`);
    const { deployer, owner } = await getDeployerAndOwnerSigners();
    console.log('Deployer:', deployer.address);
    console.log('Owner:', owner.address);
    const deploymentOptions = config.getChainConfig(chainId).v5;
    if (!deploymentOptions.IexecLibOrders_v5) {
        throw new Error('IexecLibOrders_v5 is required');
    }
    const iexecLibOrdersAddress = deploymentOptions.IexecLibOrders_v5;
    console.log(`IexecLibOrders_v5 address: ${iexecLibOrdersAddress}`);
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']: iexecLibOrdersAddress,
    };
    if (!deploymentOptions.DiamondProxy) {
        throw new Error('DiamondProxy is required');
    }
    const proxyAddress = deploymentOptions.DiamondProxy;
    console.log(`Diamond proxy address: ${proxyAddress}`);
    const proxyOnchainOwner = await Ownable__factory.connect(proxyAddress, owner).owner();
    console.log(`Diamond proxy onchain owner: ${proxyOnchainOwner}`);
    // Use impersonated signer for forked chains, otherwise use the real owner signer.
    const proxyOwner =
        isArbitrumSepoliaFork() || isArbitrumFork()
            ? await ethers.getImpersonatedSigner(proxyOnchainOwner)
            : owner;
    return {
        chainId,
        deployer,
        proxyAddress,
        proxyOwner,
        iexecLibOrders,
    };
}

function encodeModuleProxyUpdate(contractFactory: ContractFactory, moduleAddress: string) {
    // Get function selectors from the contract factory
    const functionSelectors = getFunctionSelectors(contractFactory);

    // Create FacetCut for adding the module
    const facetCut = {
        facetAddress: moduleAddress,
        action: FacetCutAction.Add,
        functionSelectors: functionSelectors,
    };

    // Encode diamondCut call
    const moduleProxyUpdateData = DiamondCutFacet__factory.createInterface().encodeFunctionData(
        'diamondCut',
        [[facetCut], ZeroAddress, '0x'],
    );
    return moduleProxyUpdateData;
}

async function printBlockTime() {
    const block = await ethers.provider.getBlock('latest');
    if (block) {
        const blockTimestamp = block.timestamp;
        console.log(
            `Block#${block.number}: ${new Date(blockTimestamp * 1000)} (timestamp:${blockTimestamp})`,
        );
    }
}

export { encodeModuleProxyUpdate, printBlockTime };
