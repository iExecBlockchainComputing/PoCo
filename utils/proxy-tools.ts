// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ContractFactory, FunctionFragment, Interface, ZeroAddress } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { FacetCut, FacetCutAction } from 'hardhat-deploy/dist/types';
import type { IDiamond } from '../typechain';
import {
    DiamondCutFacet,
    DiamondCutFacet__factory,
    DiamondLoupeFacet__factory,
    OwnershipFacet__factory,
    IexecAccessorsABILegacyFacet__factory,
    IexecCategoryManagerFacet__factory,
    IexecConfigurationExtraFacet__factory,
    IexecConfigurationFacet__factory,
    IexecERC20Facet__factory,
    IexecEscrowNativeFacet__factory,
    IexecEscrowTokenFacet__factory,
    IexecOrderManagementFacet__factory,
    IexecPoco1Facet__factory,
    IexecPoco2Facet__factory,
    IexecPocoAccessorsFacet__factory,
    IexecPocoBoostAccessorsFacet__factory,
    IexecPocoBoostFacet__factory,
    IexecRelayFacet__factory,
    Ownable__factory,
} from '../typechain';
import { getBaseNameFromContractFactory, getDeployerAndOwnerSigners } from '../utils/deploy-tools';
import { getChainConfig, isFork } from './config';
import { FactoryDeployer } from './FactoryDeployer';

const POCO_STORAGE_LOCATION = '0x5862653c6982c162832160cf30593645e8487b257e44d77cdd6b51eee2651b00';

/**
 * A type representing details of a facet used in diamond upgrades.
 */
export type FacetDetails = {
    name: string;
    address: string | null;
    factory: ContractFactory | null;
};

/**
 * Get the slot location of a storage variable in the `PocoStorage` struct.
 * @param offset The offset to add to the base location.
 * @returns The storage slot location as a hexadecimal string.
 */
export function getPocoStorageSlotLocation(offset: bigint): string {
    return ethers.toBeHex(BigInt(POCO_STORAGE_LOCATION) + offset);
}

/**
 * Link a contract to a Diamond proxy.
 * @param proxy contract to Diamond proxy.
 * @param contractAddress The contract address to link to the proxy.
 * @param contractFactory The contract factory to link to the proxy.
 */
export async function linkContractToProxy(
    proxy: DiamondCutFacet,
    contractAddress: string,
    contractFactory: ContractFactory,
) {
    const contractName = getBaseNameFromContractFactory(contractFactory);
    console.log(`Linking facet ${contractName} to diamond proxy`);
    // Fetch existing selectors from the proxy.
    const existingSelectors = await DiamondLoupeFacet__factory.connect(
        await proxy.getAddress(),
        ethers.provider,
    )
        .facets()
        .then((facets) => facets.flatMap((facet) => facet.functionSelectors));
    // Get the contract selectors from its ABI.
    const contractSelectors = getFunctionSelectors(contractFactory);
    // Exclude existing selectors to avoid the error `CannotAddFunctionToDiamondThatAlreadyExists`.
    // This appears for `owner()` function for example.
    const selectors = contractSelectors.filter((selector) => !existingSelectors.includes(selector));
    const facetCut: FacetCut = {
        facetAddress: contractAddress,
        action: FacetCutAction.Add,
        functionSelectors: selectors,
    };
    await proxy
        .diamondCut([facetCut], ZeroAddress, '0x')
        .then((tx) => tx.wait())
        .catch((err) => {
            console.log(`Failed to link ${contractName} to proxy:`);
            throw err;
        });
}

/**
 * Gets formatted function signatures from a contract's ABI.
 * @param contractFactory - The deployed contract instance
 * @returns Array of function signatures
 */
export function getFunctionSignatures(contractFactory: ContractFactory): string[] {
    return contractFactory.interface.fragments // Get all fragments from the contract's ABI
        .filter((f) => f.type === 'function' || f.type === 'fallback') // function + fallback + receive
        .map((f) => f.format()); // Format them to get clean function signatures
}

/**
 * Gets function selectors from a contract's ABI.
 * @param contract - The deployed contract instance
 * @returns Array of function selectors with utility methods
 */
export function getFunctionSelectors(contractFactory: ContractFactory): string[] {
    return (
        getFunctionSignatures(contractFactory) // Get all function signatures from the contract's ABI
            // Get the 4-byte function selectors
            .map((functionName) => {
                if (functionName === 'receive() payable') {
                    return '0x00000000'; // Receive function selector
                }
                if (functionName === 'fallback() payable') {
                    return '0xffffffff'; // Fallback function selector
                }
                return contractFactory.interface.getFunction(functionName)!.selector;
            })
    );
}

/**
 * Gets a mapping of all local facet function selectors to their names.
 * Note: local facets are not necessarily the ones deployed on-chain
 * until an upgrade is performed.
 * Note: This requires manual updates when new facets are added.
 * TODO update this when new facets are added.
 * TODO read `contracts/facets` folder to avoid manual updates.
 * @returns A map of function selectors to their names.
 */
function getAllLocalFacetFunctions(): Map<string, string> {
    const allInterfaces: Interface[] = [
        DiamondCutFacet__factory.createInterface(),
        DiamondLoupeFacet__factory.createInterface(),
        OwnershipFacet__factory.createInterface(),
        IexecAccessorsABILegacyFacet__factory.createInterface(),
        IexecCategoryManagerFacet__factory.createInterface(),
        IexecConfigurationExtraFacet__factory.createInterface(),
        IexecConfigurationFacet__factory.createInterface(),
        IexecERC20Facet__factory.createInterface(),
        IexecEscrowNativeFacet__factory.createInterface(),
        IexecEscrowTokenFacet__factory.createInterface(),
        IexecOrderManagementFacet__factory.createInterface(),
        IexecPoco1Facet__factory.createInterface(),
        IexecPoco2Facet__factory.createInterface(),
        IexecPocoAccessorsFacet__factory.createInterface(),
        IexecPocoBoostAccessorsFacet__factory.createInterface(),
        IexecPocoBoostFacet__factory.createInterface(),
        IexecRelayFacet__factory.createInterface(),
    ];
    // TODO update `getFunctionSelectors` and use it here to avoid duplication.
    const fragments: [string, string][] = allInterfaces
        .flatMap((iface) => iface.fragments)
        .filter((fragment) => fragment.type === 'function')
        .map((fragment) => fragment as FunctionFragment)
        .map((fragment) => [fragment.selector, fragment.name] as [string, string])
        .concat([
            ['0x00000000', 'receive'], // fragment.type is 'fallback'
            ['0xffffffff', 'fallback'], // fragment.type is 'fallback'
        ]);
    const selectorToName = new Map<string, string>(fragments);
    return selectorToName;
}

/**
 * Gets all deployed contract addresses and their names.
 * This is useful to print human-readable names instead of addresses.
 * @returns A mapping of contract addresses to their names.
 */
async function getAllDeployedContractsAddressesAndNames() {
    const allDeployments = await deployments.all();
    const addressesToNames: { [key: string]: string } = {};
    for (const [name, deployment] of Object.entries(allDeployments)) {
        addressesToNames[deployment.address] = name;
    }
    return addressesToNames;
}

/**
 * Gets log messages describing the facets and functions of the on-chain diamond proxy.
 * @param diamondProxyAddress The address of the diamond proxy.
 * @returns An array of log messages.
 */
async function getOnchainDiamondDescription(diamondProxyAddress: string) {
    const selectorsToNames = getAllLocalFacetFunctions();
    const addressesToNames = await getAllDeployedContractsAddressesAndNames();
    const facetsOnchain = await DiamondLoupeFacet__factory.connect(
        diamondProxyAddress,
        ethers.provider,
    ).facets();
    // Get the list of all functions with their facet names and addresses.
    const functions: { name: string; facet: string; facetAddress: string }[] = [];
    for (const facet of facetsOnchain) {
        for (const selector of facet.functionSelectors) {
            // Fallback to the selector if the name is not found.
            const functionNameOrSelector = selectorsToNames.get(selector) ?? selector;
            const facetNameOrAddress = addressesToNames[facet.facetAddress] ?? facet.facetAddress;
            functions.push({
                facet: facetNameOrAddress,
                name: functionNameOrSelector,
                facetAddress: facet.facetAddress,
            });
        }
    }
    // Sort functions by function name, then facet name
    functions.sort((f1, f2) => {
        // Sort by function name first
        const compare = f1.name.localeCompare(f2.name);
        if (compare !== 0) return compare;
        // If function names are equal, sort by facet name
        return f1.facet.localeCompare(f2.facet);
    });
    // Extract unique facet names and addresses and sort them.
    const facetsMap = new Map(functions.map((f) => [f.facet, f.facetAddress])); // unique
    const facets = [...facetsMap]
        .map(([name, address]) => ({ name, address }))
        .sort((a, b) => a.name.localeCompare(b.name));
    // Construct log message
    const logMessage = [];
    logMessage.push(
        `\n💎 Diamond proxy has ${facets.length} facets with ${functions.length} total functions.`,
    );
    logMessage.push('Facets:');
    for (const { name, address } of facets) {
        logMessage.push(`   - ${name}: ${address}`);
    }
    logMessage.push('Functions:');
    for (const func of functions) {
        logMessage.push(`   - ${func.name} -> ${func.facet}`);
    }
    return logMessage;
}

/**
 * Prints log messages describing the facets and functions of the on-chain diamond proxy
 * to stdout.
 * @param diamondProxyAddress The address of the diamond proxy.
 */
export async function printOnchainDiamondDescription(diamondProxyAddress: string) {
    const logs = await getOnchainDiamondDescription(diamondProxyAddress);
    console.log(logs.join('\n'));
}

/**
 * Saves the on-chain diamond proxy description to a log file.
 * @param diamondProxyAddress proxy address
 * @param networkName network name
 */
export async function saveOnchainDiamondDescription(
    diamondProxyAddress: string,
    networkName: string,
) {
    const path = `deployments/${networkName}/.diamond.log`;
    const logs = await getOnchainDiamondDescription(diamondProxyAddress);
    try {
        fs.writeFileSync(path, logs.join('\n') + '\n');
        console.log(`Saved diamond proxy description to ${path}`);
    } catch (error) {
        console.error(`Failed to save diamond proxy description to ${path}:`, error);
    }
}

/**
 * Get the context needed for performing a diamond upgrade.
 * @returns (chainId, deployer, proxyAddress, proxyOwner, iexecLibOrders).
 */
export async function getUpgradeContext() {
    const { chainId, name: networkName } = await ethers.provider.getNetwork();
    console.log(`Network: ${networkName} (${chainId}) (isFork: ${isFork()})`);
    const { deployer, owner } = await getDeployerAndOwnerSigners();
    console.log('Deployer:', deployer.address);
    console.log('Owner:', owner.address);
    const deploymentOptions = getChainConfig(chainId).v5;
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
    const proxyOwner = isFork() ? await ethers.getImpersonatedSigner(proxyOnchainOwner) : owner;
    return {
        chainId,
        networkName,
        deployer,
        proxyAddress,
        proxyOwner,
        iexecLibOrders,
    };
}

/**
 * Deploys facets and updates their addresses in the provided facet details.
 * @param deployer deployer signer
 * @param chainId chain ID
 * @param facets facets to deploy, must contain factories to deploy
 */
export async function deployFacets(
    deployer: SignerWithAddress,
    chainId: bigint,
    facets: FacetDetails[],
): Promise<void> {
    console.log('\n=== Deploying new facets ===');
    if (!facets || facets.length === 0) {
        throw new Error('No facets to deploy');
    }
    const factoryDeployer = new FactoryDeployer(deployer, chainId);
    for (const facet of facets) {
        const facetAddress = await factoryDeployer.deployContract(facet.factory!);
        facet.address = facetAddress;
    }
    console.log('Facets deployed successfully!');
}

/**
 * Removes whole facets from a diamond proxy.
 * @param proxyAddress address of the diamond proxy
 * @param proxyOwner owner signer of the diamond proxy
 * @param facets facets to remove, must contain their addresses
 */
export async function removeFacetsFromDiamond(
    proxyAddress: string,
    proxyOwner: SignerWithAddress,
    facets: FacetDetails[],
): Promise<void> {
    console.log('\n=== Removing whole facets from diamond ===');
    if (!facets || facets.length === 0) {
        throw new Error('No facets to remove');
    }
    const diamondLoupe = DiamondLoupeFacet__factory.connect(proxyAddress, ethers.provider);
    const diamondCutAsOwner = DiamondCutFacet__factory.connect(proxyAddress, proxyOwner);
    const facetCuts: IDiamond.FacetCutStruct[] = [];
    for (const facet of facets) {
        const selectors = await diamondLoupe.facetFunctionSelectors(facet.address!);
        if (!selectors || selectors.length === 0) {
            throw new Error(`Facet ${facet.name} is empty or does not exist on-chain`);
        }
        console.log(
            `Will remove facet [name:${facet.name}, address: ${facet.address}, functions:${selectors.length}]`,
        );
        facetCuts.push({
            facetAddress: ZeroAddress,
            action: FacetCutAction.Remove,
            functionSelectors: [...selectors],
        });
    }
    console.log(`Executing diamond cut to remove ${facetCuts.length} facets`);
    const tx = await diamondCutAsOwner.diamondCut(facetCuts, ZeroAddress, '0x');
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log('Facets removed successfully!');
}

/**
 * Links facets to a diamond proxy.
 * @param proxyAddress address of the diamond proxy
 * @param proxyOwner owner signer
 * @param facets facets to link, must contains their addresses and factories
 */
export async function linkFacetsToDiamond(
    proxyAddress: string,
    proxyOwner: SignerWithAddress,
    facets: FacetDetails[],
): Promise<void> {
    console.log('\n=== Linking facets to diamond proxy ===');
    if (!facets || facets.length === 0) {
        throw new Error('No facets to link');
    }
    const diamondCutAsOwner = DiamondCutFacet__factory.connect(proxyAddress, proxyOwner);
    for (const facet of facets) {
        if (!facet.address || !facet.factory) {
            throw new Error(`Cannot link facet ${facet.name} with null address or factory`);
        }
        await linkContractToProxy(diamondCutAsOwner, facet.address, facet.factory);
    }
    console.log('Facets linked successfully!');
}

/**
 * Removes specific functions from a diamond proxy without removing the whole facet.
 * @param proxyAddress address of the diamond proxy
 * @param proxyOwner owner signer
 * @param functionFragments list of fragments of functions to remove
 */
export async function removeFunctionsFromDiamond(
    proxyAddress: string,
    proxyOwner: SignerWithAddress,
    functionFragments: FunctionFragment[],
): Promise<void> {
    console.log('\n=== Removing specific functions from diamond ===');
    if (!functionFragments || functionFragments.length === 0) {
        throw new Error('No functions to remove');
    }
    console.log(`Removing ${functionFragments.length} functions:`);
    functionFragments.forEach((fragment) => console.log(`  - ${fragment.format()}`));
    const functionSelectors = functionFragments.map((fragment) => fragment.selector);
    const facetCuts: IDiamond.FacetCutStruct[] = [
        {
            facetAddress: ZeroAddress,
            action: FacetCutAction.Remove,
            functionSelectors: functionSelectors,
        },
    ];
    const diamondCutAsOwner = DiamondCutFacet__factory.connect(proxyAddress, proxyOwner);
    const tx = await diamondCutAsOwner.diamondCut(facetCuts, ZeroAddress, '0x');
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log('Functions removed successfully!');
}

/**
 * Removes dangling deployment artifacts for facets that are no longer linked to the diamond proxy.
 * This is not done automatically in `removeFacetsFromDiamond` because we deploy new facets first,
 * then remove old facets, which sometimes overwrites the existing ones.
 * @param proxyAddress address of the diamond proxy
 */
export async function removeDanglingFacetDeploymentArtifacts(proxyAddress: string) {
    console.log('\n=== Removing dangling deployment artifacts ===');
    const allDeployments = await deployments.all();
    const diamondLoupe = DiamondLoupeFacet__factory.connect(proxyAddress, ethers.provider);
    const onchainFacets = await diamondLoupe.facetAddresses();
    for (const deploymentName of Object.keys(allDeployments)) {
        const deploymentAddress = allDeployments[deploymentName].address;
        if (deploymentName.endsWith('Facet') && !onchainFacets.includes(deploymentAddress)) {
            console.log(
                `Deleting dangling facet artifact [name:${deploymentName}, address:${deploymentAddress}]`,
            );
            await deployments.delete(deploymentName);
        }
    }
}
