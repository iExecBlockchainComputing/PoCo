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
        this.salt = ethers.keccak256(ethers.toUtf8Bytes(salt)); // Convert string salt to bytes32
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

        // Compute bytecode hash for address prediction
        const bytecodeHash = ethers.keccak256(bytecode);

        // Get contract address (will be different prediction method based on deployment)
        let contractAddress: string;
        try {
            // Use explicit parameter types to avoid ambiguity
            contractAddress = await this.factoryContract.computeCreate2Address(
                this.salt,
                bytecodeHash,
            );
        } catch (error) {
            console.error('Error computing address:', error);
            throw new Error('Failed to compute contract address');
        }

        // Check if the contract is already deployed
        const previouslyDeployed = (await ethers.provider.getCode(contractAddress)) !== '0x';

        if (!previouslyDeployed) {
            try {
                if (initCalldata) {
                    // Deploy with initialization - explicitly specify all parameters to avoid ambiguity
                    const gasParams: [number, number] = [0, 0]; // Default gas parameters

                    // Call the specific function variant with salt and bytecode (avoiding overload ambiguity)
                    await this.factoryContract[
                        'deployCreate2AndInit(bytes32,bytes,bytes,tuple(uint256,uint256))'
                    ](this.salt, bytecode, initCalldata, gasParams).then((tx: any) => tx.wait());
                } else {
                    // Deploy without initialization - explicitly call the function with salt and bytecode
                    await this.factoryContract['deployCreate2(bytes32,bytes)'](
                        this.salt,
                        bytecode,
                    ).then((tx: any) => tx.wait());
                }
            } catch (error) {
                console.error('Deployment error:', error);
                throw new Error(`Failed to deploy contract: ${error?.message}`);
            }
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
        if (this.factoryContract) {
            // Already initialized.
            return;
        }

        // Use the imported ABI instead of defining it inline
        this.factoryContract = new ethers.Contract(this.factoryAddress, ABI, this.owner);

        // Check if the factory is deployed
        if ((await ethers.provider.getCode(this.factoryAddress)) !== '0x') {
            console.log(`→ Factory is available on this network`);
            return;
        } else {
            throw new Error('→ Factory is not deployed at the specified address');
        }
    }
}
