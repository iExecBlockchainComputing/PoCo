// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments, ethers } from 'hardhat';
import { GenericFactory, GenericFactory__factory } from '../typechain';
import { getBaseNameFromContractFactory } from './deploy-tools';
const { EthersDeployer: Deployer, factoryAddress } = require('../utils/FactoryDeployer');

export class FactoryDeployerHelper {
    salt: string;
    init: any;
    genericFactory: GenericFactory;

    constructor(owner: SignerWithAddress, salt: string) {
        this.salt = salt;
        this.init = new Deployer(owner);
        this.genericFactory = GenericFactory__factory.connect(factoryAddress, owner);
    }

    /**
     * Deploy a contract through GenericFactory [and optionally trigger a call]
     */
    async deployWithFactory(
        contractFactory: ContractFactory,
        constructorArgs?: any[],
        call?: string,
    ) {
        await this.init.ready(); // Deploy GenericFactory if not already done
        let bytecode = contractFactory.getDeployTransaction(...(constructorArgs ?? [])).data;
        if (!bytecode) {
            throw new Error('Failed to prepare bytecode');
        }
        let contractAddress = call
            ? await this.genericFactory.predictAddressWithCall(bytecode, this.salt, call)
            : await this.genericFactory.predictAddress(bytecode, this.salt);
        const previouslyDeployed = (await ethers.provider.getCode(contractAddress)) !== '0x';
        if (!previouslyDeployed) {
            call
                ? await this.genericFactory
                      .createContractAndCall(bytecode, this.salt, call)
                      .then((tx) => tx.wait())
                : await this.genericFactory
                      .createContract(bytecode, this.salt)
                      .then((tx) => tx.wait());
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
        });
        return contractAddress;
    }
}
