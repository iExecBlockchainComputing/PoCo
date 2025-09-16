// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ZeroAddress } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import {
    DiamondCutFacet__factory,
    IexecPocoDepositAndMatchNativeFacet__factory,
    IexecPocoDepositAndMatchTokenFacet__factory,
} from '../../typechain';
import { Ownable__factory } from '../../typechain/factories/rlc-faucet-contract/contracts';
import config from '../../utils/config';
import { getFunctionSelectors } from '../../utils/proxy-tools';
import { printFunctions } from '../upgrades/upgrade-helper';

(async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;
    const chainConfig = config.getChainConfig(chainId);
    console.log('Link DepositAndMatchOrders functions to proxy:');
    if (!deploymentOptions.DiamondProxy) {
        throw new Error('DiamondProxy is required');
    }
    if (!deploymentOptions.IexecLibOrders_v5) {
        throw new Error('IexecLibOrders_v5 is required');
    }
    const diamondProxyAddress = deploymentOptions.DiamondProxy;
    const iexecPocoDepositAndMatchTokenFacetAddress = (
        await deployments.get('IexecPocoDepositAndMatchTokenFacet')
    ).address;
    const iexecPocoDepositAndMatchNativeFacetAddress = (
        await deployments.get('IexecPocoDepositAndMatchNativeFacet')
    ).address;
    const [account] = await ethers.getSigners();

    // Get the diamond proxy owner instead of timelock
    const diamondProxy = DiamondCutFacet__factory.connect(diamondProxyAddress, account);
    const proxyOwnerAddress = await Ownable__factory.connect(diamondProxyAddress, account).owner();
    console.log(`Diamond proxy owner: ${proxyOwnerAddress}`);

    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
            deploymentOptions.IexecLibOrders_v5,
    };

    // Determine which facet to use based on chain configuration
    const isNative = config.isNativeChain(chainConfig);

    let facetAddress: string;
    let contractFactory: any;
    let facetName: string;

    if (isNative) {
        console.log('Using Native facet for native chain deployment');
        facetAddress = iexecPocoDepositAndMatchNativeFacetAddress;
        contractFactory = new IexecPocoDepositAndMatchNativeFacet__factory(iexecLibOrders);
        facetName = 'IexecPocoDepositAndMatchNativeFacet';
    } else {
        console.log('Using Token facet for token-based chain deployment');
        facetAddress = iexecPocoDepositAndMatchTokenFacetAddress;
        contractFactory = new IexecPocoDepositAndMatchTokenFacet__factory(iexecLibOrders);
        facetName = 'IexecPocoDepositAndMatchTokenFacet';
    }
    const functionSelectors = getFunctionSelectors(contractFactory);

    // Filter out function selectors that already exist in the diamond
    // These are common functions inherited from base contracts
    const existingSelectors = [
        '0x8da5cb5b', // owner()
        '0x4ec3b9e3', // CONTRIBUTION_DEADLINE_RATIO()
        '0x51152de1', // REVEAL_DEADLINE_RATIO()
        '0x5fde601d', // FINAL_DEADLINE_RATIO()
        '0x68a9ef1c', // WORKERPOOL_STAKE_RATIO()
        '0x7b244832', // viewAccount(address) - this was the problematic one
        '0x90fc26b1', // KITTY_RATIO()
        '0x9e986e81', // KITTY_MIN()
        '0xe2e7a8c1', // GROUPMEMBER_PURPOSE()
    ];

    const filteredSelectors = functionSelectors.filter(
        (selector) => !existingSelectors.includes(selector),
    );

    console.log(
        `Original selectors: ${functionSelectors.length}, Filtered selectors: ${filteredSelectors.length}`,
    );
    console.log('Filtered selectors:', filteredSelectors);

    // Create FacetCut for adding the module
    const facetCut = {
        facetAddress: facetAddress,
        action: FacetCutAction.Add,
        functionSelectors: filteredSelectors,
    };

    console.log(`Adding ${facetName} to diamond proxy at ${diamondProxyAddress}`);

    console.log('Functions before upgrade:');
    await printFunctions(diamondProxyAddress);

    // Impersonate the proxy owner to perform the upgrade
    const proxyOwnerSigner = await ethers.getImpersonatedSigner(proxyOwnerAddress);
    const diamondProxyWithOwner = DiamondCutFacet__factory.connect(
        diamondProxyAddress,
        proxyOwnerSigner,
    );

    console.log('Executing diamond cut directly...');
    await diamondProxyWithOwner.diamondCut([facetCut], ZeroAddress, '0x').then((tx) => tx.wait());
    console.log('Diamond cut executed successfully');

    // Print functions after upgrade
    console.log('Functions after upgrade:');
    await printFunctions(diamondProxyAddress);
})();
