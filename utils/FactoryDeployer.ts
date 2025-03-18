// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import factorySignedTxJson from 'createx/scripts/presigned-createx-deployment-transactions/signed_serialised_transaction_gaslimit_3000000_.json';
import { ContractFactory } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { ICreateX, ICreateX__factory } from '../typechain';
import { getBaseNameFromContractFactory } from './deploy-tools';
const createxAddress = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed';

export class FactoryDeployer {
    owner: SignerWithAddress;
    salt: string;
    genericFactory!: ICreateX;

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
        let contractAddress = await this.genericFactory['computeCreate2Address(bytes32,bytes32)'](
            ethers.keccak256(this.salt),
            ethers.keccak256(bytecode),
        );
        const previouslyDeployed = (await ethers.provider.getCode(contractAddress)) !== '0x';
        if (!previouslyDeployed) {
            await (
                call
                    ? this.genericFactory[
                          'deployCreate2AndInit(bytes32,bytes,bytes,(uint256,uint256))'
                      ](this.salt, bytecode, call, {
                          constructorAmount: 0,
                          initCallAmount: 0,
                      })
                    : this.genericFactory['deployCreate2(bytes32,bytes)'](this.salt, bytecode)
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
        const factorySignedTx = ethers.Transaction.from(factorySignedTxJson);
        const factoryConfig: FactoryConfig = {
            address: createxAddress,
            deployer: factorySignedTx.from!,
            cost: (factorySignedTx.gasPrice! * factorySignedTx.gasLimit!).toString(),
            tx: factorySignedTxJson,
        };
        this.genericFactory = ICreateX__factory.connect(factoryConfig.address, this.owner);
        if ((await ethers.provider.getCode(factoryConfig.address)) !== '0x') {
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
            await ethers.provider.broadcastTransaction(factoryConfig.tx).then((tx) => tx.wait());
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
    abi?: any[];
}
