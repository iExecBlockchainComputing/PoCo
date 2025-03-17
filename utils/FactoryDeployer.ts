// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Contract, ContractFactory } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { ABI } from './FactoryABI'; // Import the ABI from external file
import { getBaseNameFromContractFactory } from './deploy-tools';

export class FactoryDeployer {
    owner: SignerWithAddress;
    salt: string;
    factoryContract!: Contract;
    factoryAddress: string;

    constructor(owner: SignerWithAddress, salt: string) {
        this.owner = owner;
        this.salt = salt;
        this.factoryAddress = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed';
    }

    /**
     * Deploy a contract through the new Factory [and optionally trigger an init call]
     */
    async deployWithFactory(
        contractFactory: ContractFactory,
        constructorArgs?: any[],
        initCalldata?: string,
    ) {
        await this.init();

        // Get bytecode with constructor arguments
        let bytecode = (await contractFactory.getDeployTransaction(...(constructorArgs ?? [])))
            .data;
        if (!bytecode) {
            throw new Error('Failed to prepare bytecode');
        }

        let tx;
        let contractAddress: string | undefined;

        try {
            if (initCalldata) {
                console.log('Deploying with init code...');
                const gasParams: [number, number] = [0, 0]; // Default gas parameters

                tx = await this.factoryContract[
                    'deployCreate2AndInit(bytes32,bytes,bytes,tuple(uint256,uint256))'
                ](this.salt, bytecode, initCalldata, gasParams);
            } else {
                console.log('Deploying without init code...');
                tx = await this.factoryContract['deployCreate2(bytes32,bytes)'](
                    this.salt,
                    bytecode,
                );
            }

            const receipt = await tx.wait();

            // Extract contract address from event logs
            for (const log of receipt.logs) {
                try {
                    const parsedLog = this.factoryContract.interface.parseLog(log);
                    if (parsedLog.name === 'ContractCreation') {
                        contractAddress = parsedLog.args.newContract;
                        break;
                    }
                } catch (error) {
                    continue; // Ignore logs that don't match the event
                }
            }

            if (!contractAddress) {
                throw new Error('ContractCreation event not found in transaction receipt.');
            }
        } catch (error) {
            console.error('Deployment error:', error);
            throw new Error(`Failed to deploy contract: ${error}`);
        }

        const contractName = getBaseNameFromContractFactory(contractFactory);
        console.log(
            `${contractName}: ${contractAddress} ${
                (await ethers.provider.getCode(contractAddress)) !== '0x' ? '' : '(not deployed)'
            }`,
        );

        await deployments.save(contractName, {
            abi: (contractFactory as any).constructor.abi,
            address: contractAddress,
            bytecode: bytecode,
            args: constructorArgs,
        });

        return contractAddress;
    }

    private async init() {
        if (this.factoryContract) {
            return;
        }

        this.factoryContract = new ethers.Contract(this.factoryAddress, ABI, this.owner);

        if ((await ethers.provider.getCode(this.factoryAddress)) !== '0x') {
            console.log(`→ Factory is available on this network`);
        } else {
            throw new Error('→ Factory is not deployed at the specified address');
        }
    }
}
