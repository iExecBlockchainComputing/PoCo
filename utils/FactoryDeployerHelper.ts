// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import factoryJson from '@amxx/factory/deployments/GenericFactory.json';
import factoryShanghaiJson from '@amxx/factory/deployments/GenericFactory_shanghai.json';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ContractFactory } from 'ethers';
import hre, { deployments, ethers } from 'hardhat';
import { GenericFactory, GenericFactory__factory } from '../typechain';
import config from './config';
import { getBaseNameFromContractFactory } from './deploy-tools';

export class FactoryDeployerHelper {
    owner: SignerWithAddress;
    salt: string;
    genericFactory!: GenericFactory;

    constructor(owner: SignerWithAddress, salt: string) {
        this.owner = owner;
        this.salt = salt;
    }

    /**
     * Deploy a contract through GenericFactory [and optionally trigger a call]
     */
    async deployWithFactory(
        contractFactory: ContractFactory,
        constructorArgs?: any[],
        call?: string,
    ) {
        await this.init();
        let bytecode = (await contractFactory.getDeployTransaction(...(constructorArgs ?? [])))
            .data;
        if (!bytecode) {
            throw new Error('Failed to prepare bytecode');
        }
        let contractAddress = await (call
            ? this.genericFactory.predictAddressWithCall(bytecode, this.salt, call)
            : this.genericFactory.predictAddress(bytecode, this.salt));
        const previouslyDeployed = (await ethers.provider.getCode(contractAddress)) !== '0x';
        if (!previouslyDeployed) {
            await (
                call
                    ? this.genericFactory.createContractAndCall(bytecode, this.salt, call)
                    : this.genericFactory.createContract(bytecode, this.salt)
            ).then((tx) => tx.wait());
        }
        const contractName = getBaseNameFromContractFactory(contractFactory);
        console.log(
            `${contractName}: ${contractAddress} ${
                previouslyDeployed ? ' (previously deployed)' : ''
            }`,
        );
        await deployments.save(contractName, {
            // abi field is not used but is a required arg. Empty abi would be fine
            abi: (contractFactory as any).constructor.abi,
            address: contractAddress,
            bytecode: bytecode,
            args: constructorArgs,
        });
        return contractAddress;
    }

    private async init() {
        if (this.genericFactory) {
            // Already initialized.
            return;
        }
        const factoryConfig: FactoryConfig =
            !config.isNativeChain() && hre.network.name.includes('hardhat')
                ? factoryShanghaiJson
                : factoryJson;
        this.genericFactory = GenericFactory__factory.connect(factoryConfig.address, this.owner);
        if ((await this.owner.provider!.getCode(factoryConfig.address)) !== '0x') {
            console.log(`→ Factory is available on this network`);
            return;
        }
        try {
            console.log(`→ Factory is not yet deployed on this network`);
            await this.owner
                .sendTransaction({
                    to: factoryConfig.deployer,
                    value: factoryConfig.cost,
                })
                .then((tx) => tx.wait());
            await this.owner.provider
                .broadcastTransaction(factoryConfig.tx)
                .then((tx) => tx.wait());
            console.log(`→ Factory successfully deployed`);
        } catch (e) {
            console.log(e);
            throw new Error('→ Error deploying the factory');
        }
    }
}

interface FactoryConfig {
    address: string;
    deployer: string;
    cost: string;
    tx: string;
    abi: any[];
}
