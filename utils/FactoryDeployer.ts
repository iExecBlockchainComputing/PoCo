// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { Contract, ethers } from 'ethers';
import hre from 'hardhat';

import factoryJson from '@amxx/factory/deployments/GenericFactory.json';
import factoryShanghaiJson from '@amxx/factory/deployments/GenericFactory_shanghai.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import config from '../config/config.json';

interface FactoryConfig {
    address: string;
    deployer: string;
    cost: string;
    tx: string;
    abi: any[];
}

interface DeployOptions {
    libraries?: any[];
    salt?: string;
    call?: string;
    [key: string]: any;
}

interface Artefact {
    contractName: string;
    abi: any[];
    bytecode: string;
    at: (address: string) => Promise<any>;
    setAsDeployed: (instance: any) => void;
    _hArtifact: {
        sourceName: string;
        contractName: string;
        linkReferences?: {
            [key: string]: {
                [key: string]: Array<{
                    start: number;
                    length: number;
                }>;
            };
        };
    };
}

const FACTORY: FactoryConfig =
    config.chains.default.asset === 'Token' && hre.network.name.includes('hardhat')
        ? factoryShanghaiJson
        : factoryJson;

async function waitTx(txPromise: Promise<ethers.ContractTransaction>): Promise<void> {
    await (await txPromise).wait();
}

export class EthersDeployer {
    private factory!: Contract;
    private factoryAsPromise: Promise<Contract>;
    private options: DeployOptions;

    constructor(wallet: SignerWithAddress, options: DeployOptions = {}) {
        this.options = options;
        this.factoryAsPromise = new Promise(async (resolve, reject) => {
            if ((await wallet.provider!.getCode(FACTORY.address)) !== '0x') {
                console.debug(`→ Factory is available on this network`);
            } else {
                try {
                    console.debug(`→ Factory is not yet deployed on this network`);
                    await waitTx(
                        wallet.sendTransaction({ to: FACTORY.deployer, value: FACTORY.cost }),
                    );
                    await waitTx(wallet.provider!.sendTransaction(FACTORY.tx));
                    console.debug(`→ Factory successfully deployed`);
                } catch (e) {
                    console.debug(`→ Error deploying the factory`);
                    reject(e);
                }
            }
            this.factory = new ethers.Contract(FACTORY.address, FACTORY.abi, wallet);
            resolve(this.factory);
        });
    }

    async ready(): Promise<void> {
        await this.factoryAsPromise;
    }

    async deploy(artefact: Artefact, ...extra: any[]): Promise<void> {
        await this.ready();
        console.log(`[factoryDeployer] ${artefact.contractName}`);

        const constructorABI = artefact.abi.find((e) => e.type === 'constructor');
        const argsCount = constructorABI ? constructorABI.inputs.length : 0;
        const args = extra.slice(0, argsCount);
        const options: DeployOptions = { ...this.options, ...extra[argsCount] };

        let librariesLinkPlaceHolderAndAddress: any[] = [];
        if (options.libraries) {
            librariesLinkPlaceHolderAndAddress = await Promise.all(
                options.libraries.map(async (library) => {
                    const linkPlaceholder = this.getLinkPlaceholder(library, artefact);
                    if (linkPlaceholder) {
                        return {
                            linkPlaceholder,
                            address: (await library.deployed()).address,
                        };
                    }
                    return undefined;
                }),
            );
        }

        let coreCode = artefact.bytecode;
        librariesLinkPlaceHolderAndAddress
            .filter(
                (data): data is { linkPlaceholder: string; address: string } => data !== undefined,
            )
            .forEach((element) => {
                coreCode = coreCode.replace(
                    new RegExp(element.linkPlaceholder, 'g'),
                    element.address.slice(2).toLowerCase(),
                );
            });

        const argsCode = constructorABI
            ? ethers.utils.defaultAbiCoder
                  .encode(
                      constructorABI.inputs.map((e: { type: string }) => e.type),
                      args,
                  )
                  .slice(2)
            : '';

        const code = coreCode + argsCode;
        const salt = options.salt || ethers.constants.HashZero;
        const contractAddress = options.call
            ? await this.factory.predictAddressWithCall(code, salt, options.call)
            : await this.factory.predictAddress(code, salt);

        if ((await this.factory.provider.getCode(contractAddress)) === '0x') {
            console.log(`[factory] Preparing to deploy ${artefact.contractName} ...`);
            await waitTx(
                options.call
                    ? this.factory.createContractAndCall(code, salt, options.call)
                    : this.factory.createContract(code, salt),
            );
            console.log(
                `[factory] ${artefact.contractName} successfully deployed at ${contractAddress}`,
            );
        } else {
            console.log(
                `[factory] ${artefact.contractName} already deployed at ${contractAddress}`,
            );
        }

        const instance = await artefact.at(contractAddress);
        artefact.setAsDeployed(instance);
    }

    getLinkPlaceholder(libraryArtefact: Artefact, contractArtefact: Artefact): string | undefined {
        const hardhatLibraryArtifact = libraryArtefact._hArtifact;
        const hardhatContractArtifact = contractArtefact._hArtifact;
        if (hardhatContractArtifact.linkReferences) {
            const linkSourceName =
                hardhatContractArtifact.linkReferences[hardhatLibraryArtifact.sourceName];
            if (linkSourceName) {
                const firstLinkData = linkSourceName[hardhatLibraryArtifact.contractName][0];
                return contractArtefact.bytecode.substr(
                    firstLinkData.start * 2 + 2,
                    firstLinkData.length * 2,
                );
            }
        }
        return undefined;
    }
}

export const factoryAddress = FACTORY.address;
