// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import factorySignedTxJson from 'createx/scripts/presigned-createx-deployment-transactions/signed_serialised_transaction_gaslimit_3000000_.json';
import { ContractFactory } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { GenericFactory, GenericFactory__factory, ICreateX, ICreateX__factory } from '../typechain';
import config from '../utils/config';
import { getBaseNameFromContractFactory } from './deploy-tools';
export class FactoryDeployer {
    owner: SignerWithAddress;
    salt: string;
    factoryAddress?: string;
    factoryType: string;
    factory?: ICreateX | GenericFactory;

    constructor(owner: SignerWithAddress, chainId: bigint) {
        const deploymentOptions = config.getChainConfigOrDefault(chainId);
        this.owner = owner;
        this.salt = process.env.SALT || deploymentOptions.v5.salt || ethers.ZeroHash;
        this.factoryAddress = process.env.FACTORY_ADDRESS || deploymentOptions.v5.factory;
        this.factoryType =
            process.env.FACTORY_TYPE || deploymentOptions.v5.factoryType || 'createx';
    }

    /**
     * Deploy a contract through the configured factory [and optionally trigger a call]
     */
    async deployContract(
        contractFactory: ContractFactory,
        constructorArgs?: any[],
        call?: string,
    ): Promise<string> {
        await this.initFactory();
        if (this.factoryType === 'createx') {
            return await this.deployWithCreateX(contractFactory, constructorArgs, call);
        }
        return await this.deployWithGenericFactory(contractFactory, constructorArgs, call);
    }

    /**
     * Deploy a contract through CreateX [and optionally trigger a call]
     */
    private async deployWithCreateX(
        contractFactory: ContractFactory,
        constructorArgs?: any[],
        call?: string,
    ): Promise<string> {
        const createX = this.factory as ICreateX;
        let bytecode = (await contractFactory.getDeployTransaction(...(constructorArgs ?? [])))
            .data;
        if (!bytecode) {
            throw new Error('Failed to prepare bytecode');
        }
        const initCodeHash = ethers.keccak256(bytecode);
        const saltHash = ethers.keccak256(this.salt);
        const contractAddress = await createX['computeCreate2Address(bytes32,bytes32)'](
            saltHash,
            initCodeHash,
        );
        console.log(`Deploying at ${contractAddress}`);
        const previouslyDeployed = (await ethers.provider.getCode(contractAddress)) !== '0x';
        if (!previouslyDeployed) {
            await (
                call
                    ? createX['deployCreate2AndInit(bytes32,bytes,bytes,(uint256,uint256))'](
                          this.salt,
                          bytecode,
                          call,
                          {
                              constructorAmount: 0,
                              initCallAmount: 0,
                          },
                      )
                    : createX['deployCreate2(bytes32,bytes)'](this.salt, bytecode)
            ).then((tx) => tx.wait());
        }
        await this.saveDeployment(
            contractFactory,
            contractAddress,
            bytecode,
            constructorArgs,
            previouslyDeployed,
        );
        return contractAddress;
    }

    /**
     * Deploy a contract through GenericFactory [and optionally trigger a call]
     */
    private async deployWithGenericFactory(
        contractFactory: ContractFactory,
        constructorArgs?: any[],
        call?: string,
    ): Promise<string> {
        const genericFactory = this.factory as GenericFactory;
        let bytecode = (await contractFactory.getDeployTransaction(...(constructorArgs ?? [])))
            .data;
        if (!bytecode) {
            throw new Error('Failed to prepare bytecode');
        }
        let contractAddress = await (call
            ? genericFactory.predictAddressWithCall(bytecode, this.salt, call)
            : genericFactory.predictAddress(bytecode, this.salt));
        const previouslyDeployed = (await ethers.provider.getCode(contractAddress)) !== '0x';
        if (!previouslyDeployed) {
            await (
                call
                    ? genericFactory.createContractAndCall(bytecode, this.salt, call)
                    : genericFactory.createContract(bytecode, this.salt)
            ).then((tx) => tx.wait());
        }
        await this.saveDeployment(
            contractFactory,
            contractAddress,
            bytecode,
            constructorArgs,
            previouslyDeployed,
        );
        return contractAddress;
    }

    /**
     * Save deployment information to Hardhat deployments
     */
    private async saveDeployment(
        contractFactory: ContractFactory,
        address: string,
        bytecode: string,
        constructorArgs?: any[],
        previouslyDeployed: boolean = false,
    ): Promise<void> {
        const contractName = getBaseNameFromContractFactory(contractFactory);
        console.log(
            `${contractName}: ${address} ${previouslyDeployed ? ' (previously deployed)' : ''}`,
        );
        await deployments.save(contractName, {
            // abi field is not used but is a required arg. Empty abi would be fine
            abi: (contractFactory as any).constructor.abi,
            address: address,
            bytecode: bytecode,
            args: constructorArgs,
        });
    }

    /**
     * Initialize the appropriate factory based on factoryType
     */
    private async initFactory() {
        if (this.factory) {
            return; // Factory already initialized
        }
        if (this.factoryType === 'createx') {
            await this.initCreateX();
        } else {
            await this.initGenericFactory();
        }
    }

    /**
     * Initialize Generic Factory
     */
    private async initGenericFactory() {
        if (!this.factoryAddress) {
            throw new Error('Factory address not set for GenericFactory');
        }
        this.factory = GenericFactory__factory.connect(this.factoryAddress, this.owner);
        if ((await ethers.provider.getCode(this.factoryAddress)) !== '0x') {
            console.log(`→ GenericFactory is available on this network at ${this.factoryAddress}`);
            return;
        }
        throw new Error('GenericFactory not deployed at the provided address');
    }

    /**
     * Initialize CreateX Factory
     */
    private async initCreateX() {
        if (!this.factoryAddress) {
            try {
                console.log(`→ CreateX is not yet deployed on this network`);
                const factorySignedTx = ethers.Transaction.from(factorySignedTxJson);
                const deployer = factorySignedTx.from;
                const cost = (factorySignedTx.gasPrice! * factorySignedTx.gasLimit!).toString();
                const tx = factorySignedTxJson;

                await this.owner
                    .sendTransaction({
                        to: deployer,
                        value: cost,
                    })
                    .then((tx) => tx.wait());
                await ethers.provider.broadcastTransaction(tx).then((tx) => tx.wait());

                // Calculate the deployed contract address
                const createdContractAddress = ethers.getCreateAddress({
                    from: factorySignedTx.from!,
                    nonce: factorySignedTx.nonce,
                });
                console.log(
                    `→ CreateX successfully deployed at address: ${createdContractAddress}`,
                );
                this.factoryAddress = createdContractAddress;
                this.factory = ICreateX__factory.connect(this.factoryAddress, this.owner);
            } catch (e) {
                console.log(e);
                throw new Error('→ Error deploying CreateX');
            }
        } else {
            this.factory = ICreateX__factory.connect(this.factoryAddress, this.owner);
            if ((await ethers.provider.getCode(this.factoryAddress)) !== '0x') {
                console.log(`→ CreateX is available on this network at ${this.factoryAddress}`);
                return;
            }
            throw new Error('CreateX not deployed at the provided address');
        }
    }
}
