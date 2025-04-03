// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ContractFactory } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { ICreateX, ICreateX__factory } from '../typechain';
import { getBaseNameFromContractFactory } from './deploy-tools';

const CREATE_X_ADDRESSES = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed';

export class FactoryDeployer {
    owner: SignerWithAddress;
    salt: string;
    createX!: ICreateX;

    constructor(owner: SignerWithAddress, salt: string) {
        this.owner = owner;
        this.salt = salt;
    }

    /**
     * Deploy a contract through CreateX [and optionally trigger a call]
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

    private async init() {
        if (this.createX) {
            // Already initialized.
            return;
        }
        this.createX = ICreateX__factory.connect(CREATE_X_ADDRESSES, this.owner);
        if ((await ethers.provider.getCode(CREATE_X_ADDRESSES)) !== '0x') {
            console.log(`→ CreateX is available on this network at ${CREATE_X_ADDRESSES}`);
            return;
        }
        console.log(`→ Factory is not yet deployed on this network`);
    }
}
