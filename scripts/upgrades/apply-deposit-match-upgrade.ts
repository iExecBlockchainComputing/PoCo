// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';
import {
    DiamondCutFacet__factory,
    DiamondLoupeFacet__factory,
    IexecPocoDepositAndMatchTokenFacet__factory,
} from '../../typechain';
import { Ownable__factory } from '../../typechain/factories/rlc-faucet-contract/contracts';
import { FactoryDeployer } from '../../utils/FactoryDeployer';
import config from '../../utils/config';
import { getDeployerAndOwnerSigners } from '../../utils/deploy-tools';
import { linkContractToProxy } from '../../utils/proxy-tools';
import { tryVerify } from '../verify';
import { printFunctions } from './upgrade-helper';

(async () => {
    console.log('Deploying and adding DepositAndMatchOrders facet to diamond proxy...');

    const { deployer, owner } = await getDeployerAndOwnerSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;
    const chainConfig = config.getChainConfig(chainId);

    if (!deploymentOptions.IexecLibOrders_v5) {
        throw new Error('IexecLibOrders_v5 is required');
    }
    if (!deploymentOptions.DiamondProxy) {
        throw new Error('DiamondProxy is required');
    }

    const diamondProxyAddress = deploymentOptions.DiamondProxy;
    console.log(`Network: ${chainId}`);
    console.log(`Diamond proxy address: ${diamondProxyAddress}`);

    const proxyOwnerAddress = await Ownable__factory.connect(diamondProxyAddress, owner).owner();
    console.log(`Diamond proxy owner: ${proxyOwnerAddress}`);

    // Use impersonated signer only for fork testing, otherwise use owner signer
    const proxyOwnerSigner =
        process.env.ARBITRUM_FORK === 'true' || process.env.ARBITRUM_SEPOLIA_FORK === 'true'
            ? await ethers.getImpersonatedSigner(proxyOwnerAddress)
            : owner;
    const diamondProxyAsOwner = DiamondCutFacet__factory.connect(
        diamondProxyAddress,
        proxyOwnerSigner,
    );

    console.log('\n=== Step 1: Deploying DepositAndMatchOrders facet ===');
    const factoryDeployer = new FactoryDeployer(deployer, chainId);
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
            deploymentOptions.IexecLibOrders_v5,
    };

    console.log('Deploying IexecPocoDepositAndMatchTokenFacet...');
    const depositAndMatchFactory = new IexecPocoDepositAndMatchTokenFacet__factory(iexecLibOrders);
    const depositAndMatchFacet = await factoryDeployer.deployContract(depositAndMatchFactory);
    const facetName = 'IexecPocoDepositAndMatchTokenFacet';

    console.log(`${facetName} deployed at: ${depositAndMatchFacet}`);

    console.log('\n=== Step 2: Checking current diamond state ===');
    const diamondLoupe = DiamondLoupeFacet__factory.connect(diamondProxyAddress, owner);
    const currentFacets = await diamondLoupe.facets();

    console.log('\nCurrent facets in diamond:');
    currentFacets.forEach((facet) => {
        console.log(`  ${facet.facetAddress}: ${facet.functionSelectors.length} functions`);
    });

    console.log('\nDiamond functions before upgrade:');
    await printFunctions(diamondProxyAddress);

    console.log('\n=== Step 3: Adding DepositAndMatchOrders facet to diamond ===');

    console.log('Adding new IexecPocoDepositAndMatchTokenFacet...');
    await linkContractToProxy(diamondProxyAsOwner, depositAndMatchFacet, depositAndMatchFactory);

    console.log('\nDiamond functions after upgrade:');
    await printFunctions(diamondProxyAddress);

    // Verify the deployed contract
    await tryVerify([
        {
            name: facetName,
            address: depositAndMatchFacet,
            constructorArguments: [],
        },
    ]);
})();
