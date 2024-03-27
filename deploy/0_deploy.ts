// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractFactory } from 'ethers';
import fs from 'fs';
import hre, { deployments, ethers } from 'hardhat';
import path from 'path';
import { getFunctionSignatures } from '../migrations/utils/getFunctionSignatures';
import {
    AppRegistry__factory,
    DatasetRegistry__factory,
    ENSIntegrationDelegate__factory,
    ERC1538Proxy__factory,
    ERC1538Query,
    ERC1538QueryDelegate__factory,
    ERC1538Query__factory,
    ERC1538Update,
    ERC1538UpdateDelegate__factory,
    ERC1538Update__factory,
    GenericFactory,
    GenericFactory__factory,
    IexecAccessorsABILegacyDelegate__factory,
    IexecAccessorsDelegate__factory,
    IexecAccessors__factory,
    IexecCategoryManagerDelegate__factory,
    IexecCategoryManager__factory,
    IexecERC20Delegate__factory,
    IexecEscrowNativeDelegate__factory,
    IexecEscrowTokenDelegate__factory,
    IexecLibOrders_v5__factory,
    IexecMaintenanceDelegate__factory,
    IexecMaintenanceExtraDelegate__factory,
    IexecOrderManagementDelegate__factory,
    IexecPoco1Delegate__factory,
    IexecPoco2Delegate__factory,
    IexecPocoBoostAccessorsDelegate__factory,
    IexecPocoBoostDelegate__factory,
    IexecRelayDelegate__factory,
    RLC__factory,
    WorkerpoolRegistry__factory,
} from '../typechain';
import { Ownable__factory } from '../typechain/factories/@openzeppelin/contracts/access';
interface Category {
    name: string;
    description: string;
    workClockTimeRef: number;
}
const { EthersDeployer: Deployer, factoryAddress } = require('../utils/FactoryDeployer');
const CONFIG = require('../config/config.json');
let genericFactoryInstance: GenericFactory;
let salt: string;
// TODO: Deploy & setup ENS without hardhat-truffle

/**
 * @dev Deploying contracts with `npx hardhat deploy` task brought by
 * `hardhat-deploy` plugin.
 * Previous deployments made with `npx hardhat run scripts/deploy.ts` used to
 * hang at the end of deployments (terminal did not return at the end).
 *
 * Note:
 * The`hardhat-deploy` plugin is currently being under used compared to all
 * features available in it.
 */
module.exports = async function () {
    console.log('Deploying PoCo..');
    // Deploy GenericFactory (if not already done)
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const [owner] = await hre.ethers.getSigners();
    const factoryDeployer = new Deployer(owner);
    await factoryDeployer.ready();
    genericFactoryInstance = GenericFactory__factory.connect(factoryAddress, owner);
    // Deploy RLC
    const deploymentOptions = CONFIG.chains[chainId] || CONFIG.chains.default;
    salt = process.env.SALT || deploymentOptions.v5.salt || ethers.constants.HashZero;
    const isTokenMode = deploymentOptions.asset == 'Token';
    let rlcInstanceAddress = isTokenMode
        ? await getOrDeployRlc(deploymentOptions.token, owner) // token
        : ethers.constants.AddressZero; // native
    console.log(`RLC: ${rlcInstanceAddress}`);
    // Deploy ERC1538 proxy contracts
    const erc1538UpdateAddress = await deployWithFactory(new ERC1538UpdateDelegate__factory());
    const transferOwnershipCall = await Ownable__factory.connect(
        ethers.constants.AddressZero, // any is fine
        owner, // any is fine
    )
        .populateTransaction.transferOwnership(owner.address)
        .then((tx) => tx.data)
        .catch(() => {
            throw new Error('Failed to prepare transferOwnership data');
        });
    const erc1538ProxyAddress = await deployWithFactory(
        new ERC1538Proxy__factory(),
        [erc1538UpdateAddress],
        transferOwnershipCall,
    );
    // Save addresses of deployed PoCo contracts for later use
    saveDeployedAddress('ERC1538Proxy', erc1538ProxyAddress);
    const erc1538: ERC1538Update = ERC1538Update__factory.connect(erc1538ProxyAddress, owner);
    console.log(`IexecInstance found at address: ${erc1538.address}`);
    // Deploy library & modules
    const iexecLibOrdersAddress = await deployWithFactory(new IexecLibOrders_v5__factory());
    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']: iexecLibOrdersAddress,
    };
    const modules = [
        new ERC1538QueryDelegate__factory(),
        new IexecAccessorsDelegate__factory(),
        new IexecAccessorsABILegacyDelegate__factory(),
        new IexecCategoryManagerDelegate__factory(),
        new IexecERC20Delegate__factory(),
        isTokenMode
            ? new IexecEscrowTokenDelegate__factory()
            : new IexecEscrowNativeDelegate__factory(),
        new IexecMaintenanceDelegate__factory(iexecLibOrders),
        new IexecOrderManagementDelegate__factory(iexecLibOrders),
        new IexecPoco1Delegate__factory(iexecLibOrders),
        new IexecPoco2Delegate__factory(),
        new IexecRelayDelegate__factory(),
        new ENSIntegrationDelegate__factory(),
        new IexecMaintenanceExtraDelegate__factory(),
        new IexecPocoBoostDelegate__factory(iexecLibOrders),
        new IexecPocoBoostAccessorsDelegate__factory(),
    ];
    for (const module of modules) {
        const address = await deployWithFactory(module);
        await linkContractToProxy(erc1538, address, module);
    }
    // Verify linking on ERC1538Proxy
    const erc1538QueryInstance: ERC1538Query = ERC1538Query__factory.connect(
        erc1538ProxyAddress,
        owner,
    );
    const functionCount = await erc1538QueryInstance.totalFunctions();
    console.log(`The deployed ERC1538Proxy now supports ${functionCount} functions:`);
    for (let i = 0; i < functionCount.toNumber(); i++) {
        const [method, , contract] = await erc1538QueryInstance.functionByIndex(i);
        console.log(`[${i}] ${contract} ${method}`);
    }
    const appRegistryAddress = await deployWithFactory(
        new AppRegistry__factory(),
        [],
        transferOwnershipCall,
    );
    const datasetRegistryAddress = await deployWithFactory(
        new DatasetRegistry__factory(),
        [],
        transferOwnershipCall,
    );
    const workerpoolRegistryAddress = await deployWithFactory(
        new WorkerpoolRegistry__factory(),
        [],
        transferOwnershipCall,
    );
    // Set main configuration
    const iexecAccessorsInstance = IexecAccessors__factory.connect(erc1538ProxyAddress, owner);
    const iexecInitialized =
        (await iexecAccessorsInstance.eip712domain_separator()) != ethers.constants.HashZero;
    if (!iexecInitialized) {
        await IexecMaintenanceDelegate__factory.connect(erc1538ProxyAddress, owner)
            .configure(
                rlcInstanceAddress,
                'Staked RLC',
                'SRLC',
                9, // TODO: generic ?
                appRegistryAddress,
                datasetRegistryAddress,
                workerpoolRegistryAddress,
                ethers.constants.AddressZero,
            )
            .then((tx) => tx.wait());
    }
    // Set categories
    const catCountBefore = await iexecAccessorsInstance.countCategory();
    const categories = CONFIG.categories as Category[];
    for (let i = catCountBefore.toNumber(); i < categories.length; i++) {
        const category = categories[i];
        await IexecCategoryManager__factory.connect(erc1538ProxyAddress, owner).createCategory(
            category.name,
            JSON.stringify(category.description),
            category.workClockTimeRef,
        );
    }
    const catCountAfter = await iexecAccessorsInstance.countCategory();
    console.log(`countCategory is now: ${catCountAfter} (was ${catCountBefore})`);
    for (let i = 0; i < catCountAfter.toNumber(); i++) {
        console.log(`Category ${i}: ${await iexecAccessorsInstance.viewCategory(i)}`);
    }
};

async function getOrDeployRlc(token: string, owner: SignerWithAddress) {
    return token // token
        ? token
        : await new RLC__factory()
              .connect(owner)
              .deploy()
              .then((contract) => {
                  contract.deployed();
                  return contract.address;
              });
}

/**
 * Extract base contract name from contract factory name.
 * Inputting `MyBoxContract__factory` returns `MyBoxContract`.
 */
function getBaseNameFromContractFactory(contractFactory: any) {
    const name = contractFactory.constructor.name;
    return name.replace('__factory', '');
}

/**
 * Deploy through a GenericFactory a contract [and optionally trigger call]
 */
async function deployWithFactory(
    contractFactory: ContractFactory,
    constructorArgs?: any[],
    call?: string,
) {
    let bytecode = contractFactory.getDeployTransaction(...(constructorArgs ?? [])).data;
    if (!bytecode) {
        throw new Error('Failed to prepare bytecode');
    }
    let contractAddress = call
        ? await genericFactoryInstance.predictAddressWithCall(bytecode, salt, call)
        : await genericFactoryInstance.predictAddress(bytecode, salt);
    const previouslyDeployed = (await ethers.provider.getCode(contractAddress)) !== '0x';
    if (!previouslyDeployed) {
        call
            ? await genericFactoryInstance
                  .createContractAndCall(bytecode, salt, call)
                  .then((tx) => tx.wait())
            : await genericFactoryInstance.createContract(bytecode, salt).then((tx) => tx.wait());
    }
    const contractName = getBaseNameFromContractFactory(contractFactory);
    console.log(
        `${contractName}: ${contractAddress} ${previouslyDeployed ? ' (previously deployed)' : ''}`,
    );
    await deployments.save(contractName, {
        abi: (contractFactory as any).constructor.abi,
        address: contractAddress,
    });
    return contractAddress;
}

/**
 * Link a contract to an ERC1538 proxy.
 * @param proxy contract to ERC1538 proxy.
 * @param contractAddress The contract address to link to the proxy.
 * @param contractFactory The contract factory to link to the proxy.
 */
async function linkContractToProxy(
    proxy: ERC1538Update,
    contractAddress: string,
    contractFactory: any,
) {
    const contractName = getBaseNameFromContractFactory(contractFactory);
    await proxy
        .updateContract(
            contractAddress,
            // TODO: Use contractFactory.interface.functions when moving to ethers@v6
            // https://github.com/ethers-io/ethers.js/issues/1069
            getFunctionSignatures(contractFactory.constructor.abi),
            'Linking ' + contractName,
        )
        .catch(() => {
            throw new Error(`Failed to link ${contractName}`);
        });
}

// TODO [optional]: Use hardhat-deploy to save addresses automatically
// https://github.com/wighawag/hardhat-deploy/tree/master#hardhat-deploy-in-a-nutshell
/**
 * Save addresses of deployed contracts (since hardhat does not do it for us).
 * @param contractName contract name to deploy
 * @param deployedAddress address where contract where deployed
 */
function saveDeployedAddress(contractName: string, deployedAddress: string) {
    const chainId = hre.network.config.chainId || 0;
    const BUILD_DIR = '../build';
    fs.writeFileSync(
        path.resolve(__dirname, BUILD_DIR, `${contractName}.json`),
        JSON.stringify({
            networks: {
                [chainId]: {
                    address: deployedAddress,
                },
            },
        }),
    );
    console.log(`Saved deployment at ${deployedAddress} for ${contractName}`);
}

module.exports.tags = ['IexecPocoBoostDelegate'];
