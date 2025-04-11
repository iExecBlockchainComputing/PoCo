// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import factorySignedTxJson from 'createx/scripts/presigned-createx-deployment-transactions/signed_serialised_transaction_gaslimit_3000000_.json';
import { ContractFactory } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { GenericFactory, GenericFactory__factory, ICreateX, ICreateX__factory } from '../typechain';
import { getBaseNameFromContractFactory } from './deploy-tools';

export class FactoryDeployer {
    owner: SignerWithAddress;
    salt: string;
    factoryAddress?: string;
    createX!: ICreateX;
    genericFactory!: GenericFactory;

    constructor(owner: SignerWithAddress, salt: string, factoryAddress?: string) {
        this.owner = owner;
        this.salt = salt;
        this.factoryAddress = factoryAddress;
    }

    /**
     * Deploy a contract through CreateX [and optionally trigger a call]
     */
    async deployWithFactory(
        contractFactory: ContractFactory,
        constructorArgs?: any[],
        call?: string,
    ) {
        await this.initCreateX();
        let bytecode = (await contractFactory.getDeployTransaction(...(constructorArgs ?? [])))
            .data;
        if (!bytecode) {
            throw new Error('Failed to prepare bytecode');
        }
        const initCodeHash = ethers.keccak256(bytecode);
        const saltHash = ethers.keccak256(this.salt);
        const contractAddress = await this.createX['computeCreate2Address(bytes32,bytes32)'](
            saltHash,
            initCodeHash,
        );
        console.log(`Deploying at ${contractAddress}`);
        const previouslyDeployed = (await ethers.provider.getCode(contractAddress)) !== '0x';
        if (!previouslyDeployed) {
            await (
                call
                    ? this.createX['deployCreate2AndInit(bytes32,bytes,bytes,(uint256,uint256))'](
                          this.salt,
                          bytecode,
                          call,
                          {
                              constructorAmount: 0,
                              initCallAmount: 0,
                          },
                      )
                    : this.createX['deployCreate2(bytes32,bytes)'](this.salt, bytecode)
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

    /**
     * Deploy a contract through GenericFactory [and optionally trigger a call]
     */
    async deployWithGeneric(
        contractFactory: ContractFactory,
        constructorArgs?: any[],
        call?: string,
    ) {
        await this.initLegacy();
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

    private async initLegacy() {
        if (this.genericFactory) {
            return;
        }
        if (!this.factoryAddress) {
            throw new Error('Factory address not set');
        }
        this.genericFactory = GenericFactory__factory.connect(this.factoryAddress, this.owner);
        if ((await ethers.provider.getCode(this.factoryAddress)) !== '0x') {
            console.log(`→ Factory is available on this network`);
            return;
        }
    }

    private async initCreateX() {
        if (this.createX) {
            return;
        }
        if (!this.factoryAddress) {
            // Use full in case of working with local hardhat network, or bellecour
            try {
                console.log(`→ Factory is not yet deployed on this network`);
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
                // For a contract creation transaction, the address is determined by the sender and nonce
                const createdContractAddress = ethers.getCreateAddress({
                    from: factorySignedTx.from!,
                    nonce: factorySignedTx.nonce,
                });
                console.log(
                    `→ Factory successfully deployed at address: ${createdContractAddress}`,
                );
                this.factoryAddress = createdContractAddress;
                this.createX = ICreateX__factory.connect(this.factoryAddress, this.owner);
            } catch (e) {
                console.log(e);
                throw new Error('→ Error deploying the factory');
            }
        } else {
            this.createX = ICreateX__factory.connect(this.factoryAddress, this.owner);
            if ((await ethers.provider.getCode(this.factoryAddress)) !== '0x') {
                console.log(`→ CreateX is available on this network at ${this.factoryAddress}`);
                return;
            }
        }
    }
}
