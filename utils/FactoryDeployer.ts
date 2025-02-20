// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import factoryJson from '@amxx/factory/deployments/GenericFactory.json';
import factoryShanghaiJson from '@amxx/factory/deployments/GenericFactory_shanghai.json';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Contract, ethers } from 'ethers';
import hre from 'hardhat';
import { isNativeChain } from '../config/config-utils';

interface FactoryConfig {
    address: string;
    deployer: string;
    cost: string;
    tx: string;
    abi: any[];
}

const factoryConfig =
    !isNativeChain() && hre.network.name.includes('hardhat') ? factoryShanghaiJson : factoryJson;

export class EthersDeployer {
    private factory!: Contract;
    private factoryAsPromise: Promise<Contract>;

    constructor(wallet: SignerWithAddress) {
        this.factoryAsPromise = new Promise(async (resolve, reject) => {
            if ((await wallet.provider!.getCode(factoryConfig.address)) !== '0x') {
                console.log(`→ Factory is available on this network`);
            } else {
                try {
                    console.log(`→ Factory is not yet deployed on this network`);
                    await wallet
                        .sendTransaction({
                            to: factoryConfig.deployer,
                            value: factoryConfig.cost,
                        })
                        .then((tx) => tx.wait());
                    await wallet.provider
                        .broadcastTransaction(factoryConfig.tx)
                        .then((tx) => tx.wait());
                    console.log(`→ Factory successfully deployed`);
                } catch (e) {
                    console.log(`→ Error deploying the factory`);
                    reject(e);
                }
            }
            this.factory = new ethers.Contract(factoryConfig.address, factoryConfig.abi, wallet);
            resolve(this.factory);
        });
    }

    async ready(): Promise<void> {
        await this.factoryAsPromise;
    }
}

export const factoryAddress = factoryConfig.address;
