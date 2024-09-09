// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { BytesLike } from '@ethersproject/bytes';
import { AddressZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import hre, { deployments, ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    AppRegistry,
    AppRegistry__factory,
    DatasetRegistry,
    DatasetRegistry__factory,
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
} from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';
const constants = require('../../../utils/constants');
const randomAddress = () => ethers.Wallet.createRandom().address;

describe('Registries', () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsAdmin]: IexecInterfaceNative[] = [];
    let [iexecAdmin, appProvider, datasetProvider, scheduler, anyone]: SignerWithAddress[] = [];

    let ensRegistryAddress: string;
    let appRegistry: AppRegistry;
    let datasetRegistry: DatasetRegistry;
    let workerpoolRegistry: WorkerpoolRegistry;

    beforeEach(async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        ({ iexecAdmin, appProvider, datasetProvider, scheduler, anyone } =
            await getIexecAccounts());
        ensRegistryAddress = (await deployments.get('ENSRegistry')).address;
        const appRegistryAddress = (await deployments.get('AppRegistry')).address;
        appRegistry = AppRegistry__factory.connect(appRegistryAddress, iexecAdmin);
        const datasetRegistryAddress = (await deployments.get('DatasetRegistry')).address;
        datasetRegistry = DatasetRegistry__factory.connect(datasetRegistryAddress, iexecAdmin);
        const workerpoolRegistryAddress = (await deployments.get('WorkerpoolRegistry')).address;
        workerpoolRegistry = WorkerpoolRegistry__factory.connect(
            workerpoolRegistryAddress,
            iexecAdmin,
        );

        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsAdmin = iexecPoco.connect(iexecAdmin);
    }

    describe('Registry', () => {
        it('Should retrieve base URI', async () => {
            const chainId = hre.network.config.chainId;
            expect(await appRegistry.baseURI()).to.equal(
                `https://nfts-metadata.iex.ec/app/${chainId}/`,
            );
            expect(await datasetRegistry.baseURI()).to.equal(
                `https://nfts-metadata.iex.ec/dataset/${chainId}/`,
            );
            expect(await workerpoolRegistry.baseURI()).to.equal(
                `https://nfts-metadata.iex.ec/workerpool/${chainId}/`,
            );
        });
        it('Should not set name when user is not the owner', async () => {
            await expect(
                appRegistry.connect(anyone).setName(ensRegistryAddress, 'new.app.registry.eth'),
            ).to.be.revertedWith('Ownable: caller is not the owner');
            await expect(
                datasetRegistry
                    .connect(anyone)
                    .setName(ensRegistryAddress, 'new.dataset.registry.eth'),
            ).to.be.revertedWith('Ownable: caller is not the owner');
            await expect(
                workerpoolRegistry
                    .connect(anyone)
                    .setName(ensRegistryAddress, 'new.workerpool.registry.eth'),
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
        it('Should not set base URI when user is not the owner', async () => {
            await expect(
                appRegistry.connect(anyone).setBaseURI(`https://new.url.iex.ec/app/`),
            ).to.be.revertedWith('Ownable: caller is not the owner');
            await expect(
                datasetRegistry.connect(anyone).setBaseURI(`https://new.url.iex.ec/dataset/`),
            ).to.be.revertedWith('Ownable: caller is not the owner');
            await expect(
                workerpoolRegistry.connect(anyone).setBaseURI(`https://new.url.iex.ec/workerpool/`),
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
        it('Should not call initialize when user is not the owner', async () => {
            await expect(appRegistry.connect(anyone).initialize(AddressZero)).to.be.revertedWith(
                'Ownable: caller is not the owner',
            );
            await expect(
                datasetRegistry.connect(anyone).initialize(AddressZero),
            ).to.be.revertedWith('Ownable: caller is not the owner');
            await expect(
                workerpoolRegistry.connect(anyone).initialize(AddressZero),
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
        it('Should not reinitialize', async () => {
            await expect(appRegistry.initialize(AddressZero)).to.be.revertedWithoutReason();
            await expect(datasetRegistry.initialize(AddressZero)).to.be.revertedWithoutReason();
            await expect(workerpoolRegistry.initialize(AddressZero)).to.be.revertedWithoutReason();
        });
    });

    describe('App Registry', () => {
        const createAppArgs = [
            `App`,
            'DOCKER',
            constants.MULTIADDR_BYTES,
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Content of my app`)),
            '0x1234',
        ] as [string, string, BytesLike, BytesLike, BytesLike];

        it('Should predict the correct address for future app creation', async () => {
            const code = await appRegistry.proxyCode();
            const proxyCodeHash = ethers.utils.keccak256(code);

            const iface = new ethers.utils.Interface([
                'function initialize(string,string,bytes,bytes32,bytes)',
            ]);
            const encodedInitializer = iface.encodeFunctionData('initialize', createAppArgs);

            const salt = ethers.utils.solidityKeccak256(
                ['bytes', 'address'],
                [encodedInitializer, appProvider.address],
            );

            const predictedAddress = ethers.utils.getCreate2Address(
                appRegistry.address,
                salt,
                proxyCodeHash,
            );
            expect(await appRegistry.predictApp(appProvider.address, ...createAppArgs)).to.equal(
                predictedAddress,
            );
        });

        it('Should create the app', async () => {
            const predictedAddress = await appRegistry.predictApp(
                appProvider.address,
                ...createAppArgs,
            );
            await expect(await appRegistry.createApp(appProvider.address, ...createAppArgs))
                .to.emit(appRegistry, 'Transfer')
                .withArgs(
                    AddressZero,
                    appProvider.address,
                    ethers.BigNumber.from(predictedAddress).toString(),
                );
        });

        it('Should check that a new app is well registered', async () => {
            const appCreatedAddress = await appRegistry.callStatic.createApp(
                appProvider.address,
                ...createAppArgs,
            );
            await appRegistry.createApp(appProvider.address, ...createAppArgs);
            const isRegistered = await appRegistry.isRegistered(appCreatedAddress);
            expect(isRegistered).to.be.true;
        });
        it('Should not have a random address registered in app registry', async () => {
            expect(await appRegistry.isRegistered(randomAddress())).to.be.false;
        });
        it('Should not allow creating the same app twice', async () => {
            await appRegistry.createApp(appProvider.address, ...createAppArgs);

            await expect(
                appRegistry.createApp(appProvider.address, ...createAppArgs),
            ).to.be.revertedWith('Create2: Failed on deploy');
        });
        it('Should check that a new app is well registered on new app registry', async () => {
            const appCreatedAddress = await appRegistry.callStatic.createApp(
                appProvider.address,
                ...createAppArgs,
            );
            await appRegistry.createApp(appProvider.address, ...createAppArgs);

            const newAppRegistry = await new AppRegistry__factory()
                .connect(iexecAdmin)
                .deploy()
                .then((contract) => contract.deployed());

            await newAppRegistry.initialize(appRegistry.address);
            const isRegistered = await newAppRegistry.isRegistered(appCreatedAddress);
            expect(isRegistered).to.be.true;
        });
    });

    describe('Dataset Registry', () => {
        const createDatasetArgs = [
            `Dataset`,
            constants.MULTIADDR_BYTES,
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Content of my dataset`)),
        ] as [string, BytesLike, BytesLike];

        it('Should predict the correct address for future dataset creation', async () => {
            const code = await datasetRegistry.proxyCode();
            const proxyCodeHash = ethers.utils.keccak256(code);

            const iface = new ethers.utils.Interface(['function initialize(string,bytes,bytes32)']);
            const encodedInitializer = iface.encodeFunctionData('initialize', createDatasetArgs);

            const salt = ethers.utils.solidityKeccak256(
                ['bytes', 'address'],
                [encodedInitializer, datasetProvider.address],
            );

            const predictedAddress = ethers.utils.getCreate2Address(
                datasetRegistry.address,
                salt,
                proxyCodeHash,
            );
            expect(
                await datasetRegistry.predictDataset(datasetProvider.address, ...createDatasetArgs),
            ).to.equal(predictedAddress);
        });

        it('Should create the dataset', async () => {
            const predictedAddress = await datasetRegistry.predictDataset(
                datasetProvider.address,
                ...createDatasetArgs,
            );
            await expect(
                await datasetRegistry.createDataset(datasetProvider.address, ...createDatasetArgs),
            )
                .to.emit(datasetRegistry, 'Transfer')
                .withArgs(
                    AddressZero,
                    datasetProvider.address,
                    ethers.BigNumber.from(predictedAddress).toString(),
                );
        });
        it('Should check that a new dataset is well registered', async () => {
            const datasetCreatedAddress = await datasetRegistry.callStatic.createDataset(
                datasetProvider.address,
                ...createDatasetArgs,
            );
            await datasetRegistry.createDataset(datasetProvider.address, ...createDatasetArgs);
            const isRegistered = await datasetRegistry.isRegistered(datasetCreatedAddress);
            expect(isRegistered).to.be.true;
        });
        it('Should not have a random address registered in dataset registry', async () => {
            expect(await datasetRegistry.isRegistered(randomAddress())).to.be.false;
        });
        it('Should not allow creating the same dataset twice', async () => {
            await datasetRegistry.createDataset(datasetProvider.address, ...createDatasetArgs);

            await expect(
                datasetRegistry.createDataset(datasetProvider.address, ...createDatasetArgs),
            ).to.be.revertedWith('Create2: Failed on deploy');
        });
    });

    describe('Workerpool Registry', () => {
        const createWorkerpoolArgs = [`Workerpool description`] as [string];

        it('Should predict the correct address for future workerpool creation', async () => {
            const proxyCode = await workerpoolRegistry.proxyCode();
            const proxyCodeHash = ethers.utils.keccak256(proxyCode);

            const iface = new ethers.utils.Interface(['function initialize(string)']);
            const encodedInitializer = iface.encodeFunctionData('initialize', createWorkerpoolArgs);

            const salt = ethers.utils.solidityKeccak256(
                ['bytes', 'address'],
                [encodedInitializer, scheduler.address],
            );

            const expectedAddress = ethers.utils.getCreate2Address(
                workerpoolRegistry.address,
                salt,
                proxyCodeHash,
            );

            const predictedAddress = await workerpoolRegistry.predictWorkerpool(
                scheduler.address,
                ...createWorkerpoolArgs,
            );

            expect(predictedAddress).to.equal(expectedAddress);
        });

        it('Should create the workerpool', async () => {
            const predictedAddress = await workerpoolRegistry.predictWorkerpool(
                scheduler.address,
                ...createWorkerpoolArgs,
            );
            await expect(
                await workerpoolRegistry.createWorkerpool(
                    scheduler.address,
                    ...createWorkerpoolArgs,
                ),
            )
                .to.emit(workerpoolRegistry, 'Transfer')
                .withArgs(
                    AddressZero,
                    scheduler.address,
                    ethers.BigNumber.from(predictedAddress).toString(),
                );
        });
        it('Should check that a new workerpool is well registered', async () => {
            const workerpoolCreatedAddress = await workerpoolRegistry.callStatic.createWorkerpool(
                scheduler.address,
                ...createWorkerpoolArgs,
            );
            await workerpoolRegistry.createWorkerpool(scheduler.address, ...createWorkerpoolArgs);
            const isRegistered = await workerpoolRegistry.isRegistered(workerpoolCreatedAddress);
            expect(isRegistered).to.be.true;
        });
        it('Should not have a random address registered in workerpool registry', async () => {
            expect(await workerpoolRegistry.isRegistered(randomAddress())).to.be.false;
        });
        it('Should not allow creating the same workerpool twice', async () => {
            await workerpoolRegistry.createWorkerpool(scheduler.address, ...createWorkerpoolArgs);

            await expect(
                workerpoolRegistry.createWorkerpool(scheduler.address, ...createWorkerpoolArgs),
            ).to.be.revertedWith('Create2: Failed on deploy');
        });
    });
});
