// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BytesLike, ZeroAddress } from 'ethers';
import hre, { ethers } from 'hardhat';
import {
    AppRegistry,
    AppRegistry__factory,
    App__factory,
    DatasetRegistry,
    DatasetRegistry__factory,
    Dataset__factory,
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    InitializableUpgradeabilityProxy__factory,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
    Workerpool__factory,
} from '../../../typechain';
import config from '../../../utils/config';
import { MULTIADDR_BYTES } from '../../../utils/constants';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { bigintToAddress } from '../../../utils/tools';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';
import { randomAddress } from '../../utils/utils';

describe('Registries', () => {
    let proxyAddress: string;
    let iexecPoco: IexecInterfaceNative;
    let [iexecAdmin, appProvider, datasetProvider, scheduler, anyone]: SignerWithAddress[] = [];

    let [appRegistry, appRegistryAsAdmin]: AppRegistry[] = [];
    let appRegistryAddress: string;
    let [datasetRegistry, datasetRegistryAsAdmin]: DatasetRegistry[] = [];
    let datasetRegistryAddress: string;
    let [workerpoolRegistry, workerpoolRegistryAsAdmin]: WorkerpoolRegistry[] = [];
    let workerpoolRegistryAddress: string;

    beforeEach(async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        ({ iexecAdmin, appProvider, datasetProvider, scheduler, anyone } =
            await getIexecAccounts());

        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);

        appRegistry = AppRegistry__factory.connect(await iexecPoco.appregistry(), anyone);
        appRegistryAddress = await appRegistry.getAddress();
        appRegistryAsAdmin = appRegistry.connect(iexecAdmin);
        datasetRegistry = DatasetRegistry__factory.connect(
            await iexecPoco.datasetregistry(),
            anyone,
        );
        datasetRegistryAddress = await datasetRegistry.getAddress();
        datasetRegistryAsAdmin = datasetRegistry.connect(iexecAdmin);
        workerpoolRegistry = WorkerpoolRegistry__factory.connect(
            await iexecPoco.workerpoolregistry(),
            anyone,
        );
        workerpoolRegistryAddress = await workerpoolRegistry.getAddress();
        workerpoolRegistryAsAdmin = workerpoolRegistry.connect(iexecAdmin);
    }

    describe('initialize', () => {
        it('Should initialize new deployed registries', async () => {
            const newAppRegistry = await new AppRegistry__factory()
                .connect(iexecAdmin)
                .deploy()
                .then((contract) => contract.waitForDeployment());
            await newAppRegistry.initialize(appRegistryAddress).then((tx) => tx.wait());
            expect(await newAppRegistry.initialized()).to.be.true;
            expect(await newAppRegistry.previous()).to.equal(appRegistryAddress);

            const newDatasetRegistry = await new DatasetRegistry__factory()
                .connect(iexecAdmin)
                .deploy()
                .then((contract) => contract.waitForDeployment());
            await newDatasetRegistry.initialize(datasetRegistryAddress).then((tx) => tx.wait());
            expect(await newDatasetRegistry.initialized()).to.be.true;
            expect(await newDatasetRegistry.previous()).to.equal(datasetRegistryAddress);

            const newWorkerpoolRegistry = await new WorkerpoolRegistry__factory()
                .connect(iexecAdmin)
                .deploy()
                .then((contract) => contract.waitForDeployment());
            await newWorkerpoolRegistry
                .initialize(workerpoolRegistryAddress)
                .then((tx) => tx.wait());
            expect(await newWorkerpoolRegistry.initialized()).to.be.true;
            expect(await newWorkerpoolRegistry.previous()).to.equal(workerpoolRegistryAddress);
        });

        it('Should not initialize when user is not the owner', async () => {
            await expect(appRegistry.initialize(ZeroAddress))
                .to.be.revertedWithCustomError(appRegistry, 'OwnableUnauthorizedAccount')
                .withArgs(anyone.address);
            await expect(datasetRegistry.initialize(ZeroAddress))
                .to.be.revertedWithCustomError(datasetRegistry, 'OwnableUnauthorizedAccount')
                .withArgs(anyone.address);
            await expect(workerpoolRegistry.initialize(ZeroAddress))
                .to.be.revertedWithCustomError(workerpoolRegistry, 'OwnableUnauthorizedAccount')
                .withArgs(anyone.address);
        });

        it('Should not reinitialize', async () => {
            await expect(appRegistryAsAdmin.initialize(ZeroAddress)).to.be.revertedWithoutReason();
            await expect(
                datasetRegistryAsAdmin.initialize(ZeroAddress),
            ).to.be.revertedWithoutReason();
            await expect(
                workerpoolRegistryAsAdmin.initialize(ZeroAddress),
            ).to.be.revertedWithoutReason();
        });
    });

    describe('setBaseURI', () => {
        it('Should retrieve base URI', async () => {
            const chainId = hre.network.config.chainId;
            const baseURIApp = config.registriesBaseUri.app;
            const baseURIDataset = config.registriesBaseUri.dataset;
            const baseURIWorkerpool = config.registriesBaseUri.workerpool;
            expect(await appRegistry.baseURI()).to.equal(`${baseURIApp}/${chainId}/`);
            expect(await datasetRegistry.baseURI()).to.equal(`${baseURIDataset}/${chainId}/`);
            expect(await workerpoolRegistry.baseURI()).to.equal(`${baseURIWorkerpool}/${chainId}/`);
        });

        it('Should not set base URI when user is not the owner', async () => {
            await expect(appRegistry.setBaseURI(`https://new.url.iex.ec/app/`))
                .to.be.revertedWithCustomError(appRegistry, 'OwnableUnauthorizedAccount')
                .withArgs(anyone.address);
            await expect(datasetRegistry.setBaseURI(`https://new.url.iex.ec/dataset/`))
                .to.be.revertedWithCustomError(datasetRegistry, 'OwnableUnauthorizedAccount')
                .withArgs(anyone.address);
            await expect(workerpoolRegistry.setBaseURI(`https://new.url.iex.ec/workerpool/`))
                .to.be.revertedWithCustomError(workerpoolRegistry, 'OwnableUnauthorizedAccount')
                .withArgs(anyone.address);
        });
    });

    describe('Registry Getters', () => {
        it('Should check that masters are deployed at master addresses', async () => {
            const appCode = App__factory.bytecode.replace('0x', '');
            const datasetCode = Dataset__factory.bytecode.replace('0x', '');
            const workerpoolCode = Workerpool__factory.bytecode.replace('0x', '');

            const deployedCodeAtAppRegistryMaster = (
                await ethers.provider.getCode(await appRegistry.master())
            ).replace('0x', '');
            const deployedCodeAtDatasetRegistryMaster = (
                await ethers.provider.getCode(await datasetRegistry.master())
            ).replace('0x', '');
            const deployedCodeAtWorkerpoolRegistryMaster = (
                await ethers.provider.getCode(await workerpoolRegistry.master())
            ).replace('0x', '');

            expect(appCode.includes(deployedCodeAtAppRegistryMaster)).to.be.true;
            expect(datasetCode.includes(deployedCodeAtDatasetRegistryMaster)).to.be.true;
            expect(workerpoolCode.includes(deployedCodeAtWorkerpoolRegistryMaster)).to.be.true;
        });

        it('Should retrieve correct ERC 721 name', async () => {
            expect(await appRegistry.name()).to.equal('iExec Application Registry (V5)');
            expect(await datasetRegistry.name()).to.equal('iExec Dataset Registry (V5)');
            expect(await workerpoolRegistry.name()).to.equal('iExec Workerpool Registry (V5)');
        });

        it('Should retrieve correct ERC 721 symbol', async () => {
            expect(await appRegistry.symbol()).to.equal('iExecAppsV5');
            expect(await datasetRegistry.symbol()).to.equal('iExecDatasetsV5');
            expect(await workerpoolRegistry.symbol()).to.equal('iExecWorkerpoolV5');
        });

        it('Should return the correct value for proxyCode', async () => {
            const expectedProxyCode = InitializableUpgradeabilityProxy__factory.bytecode;
            expect(await appRegistry.proxyCode()).to.equal(expectedProxyCode);
            expect(await datasetRegistry.proxyCode()).to.equal(expectedProxyCode);
            expect(await workerpoolRegistry.proxyCode()).to.equal(expectedProxyCode);
        });

        it('Should return the correct value for proxyCodeHash', async () => {
            const proxyCode = InitializableUpgradeabilityProxy__factory.bytecode;
            expect(await appRegistry.proxyCodeHash()).to.equal(ethers.keccak256(proxyCode));
            expect(await datasetRegistry.proxyCodeHash()).to.equal(ethers.keccak256(proxyCode));
            expect(await workerpoolRegistry.proxyCodeHash()).to.equal(ethers.keccak256(proxyCode));
        });

        it('Should return the correct value for previous registry', async () => {
            expect(await appRegistry.previous()).to.equal(ZeroAddress);
            expect(await datasetRegistry.previous()).to.equal(ZeroAddress);
            expect(await workerpoolRegistry.previous()).to.equal(ZeroAddress);
        });

        it('Should current regitries be initialized', async () => {
            expect(await appRegistry.initialized()).to.be.true;
            expect(await datasetRegistry.initialized()).to.be.true;
            expect(await workerpoolRegistry.initialized()).to.be.true;
        });
    });

    describe('App Registry', () => {
        const createAppArgs = [
            `App`,
            'DOCKER',
            MULTIADDR_BYTES,
            ethers.id(`My app checksum`),
            '0x1234',
        ] as [string, string, BytesLike, BytesLike, BytesLike];
        it('Should predict the correct address for future app creation', async () => {
            const code = await appRegistry.proxyCode();
            const proxyCodeHash = ethers.keccak256(code);
            const encodedInitializer = App__factory.createInterface().encodeFunctionData(
                'initialize',
                createAppArgs,
            );
            const salt = ethers.solidityPackedKeccak256(
                ['bytes', 'address'],
                [encodedInitializer, appProvider.address],
            );

            const predictedAddress = ethers.getCreate2Address(
                appRegistryAddress,
                salt,
                proxyCodeHash,
            );
            expect(await appRegistry.predictApp(appProvider.address, ...createAppArgs)).to.equal(
                predictedAddress,
            );
        });

        it('Should create the app and check token details', async () => {
            const initialAppBalance = await appRegistry.balanceOf(appProvider.address);
            expect(initialAppBalance).to.equal(0);

            const predictedAddress = await appRegistry.predictApp(
                appProvider.address,
                ...createAppArgs,
            );
            await expect(appRegistry.createApp(appProvider.address, ...createAppArgs))
                .to.emit(appRegistry, 'Transfer')
                .withArgs(ZeroAddress, appProvider.address, predictedAddress);
            expect(await appRegistry.balanceOf(appProvider.address)).to.equal(
                initialAppBalance + 1n,
            );
            expect(await appRegistry.ownerOf(predictedAddress)).to.equal(appProvider.address);

            const tokenAtIndex = await appRegistry.tokenOfOwnerByIndex(appProvider.address, 0);
            expect(bigintToAddress(tokenAtIndex)).to.equal(ethers.getAddress(predictedAddress));

            const tokenURI = await appRegistry.tokenURI(predictedAddress);
            const baseURI = await appRegistry.baseURI();
            expect(tokenURI).to.equal(baseURI + BigInt(predictedAddress));
        });

        it('Should check that a new app is well registered', async () => {
            const appCreatedAddress = await appRegistry.createApp.staticCall(
                appProvider.address,
                ...createAppArgs,
            );
            await appRegistry
                .createApp(appProvider.address, ...createAppArgs)
                .then((tx) => tx.wait());
            const isRegistered = await appRegistry.isRegistered(appCreatedAddress);
            expect(isRegistered).to.be.true;
        });

        it('Should not have a random address registered in app registry', async () => {
            expect(await appRegistry.isRegistered(randomAddress())).to.be.false;
        });

        it('Should not allow creating the same app twice', async () => {
            await appRegistry
                .createApp(appProvider.address, ...createAppArgs)
                .then((tx) => tx.wait());

            await expect(
                appRegistry.createApp(appProvider.address, ...createAppArgs),
            ).to.be.revertedWithCustomError(appRegistry, 'Create2FailedDeployment');
        });

        it('Should check that a new app is well registered on new app registry', async () => {
            const appCreatedAddress = await appRegistry.createApp.staticCall(
                appProvider.address,
                ...createAppArgs,
            );
            await appRegistry
                .createApp(appProvider.address, ...createAppArgs)
                .then((tx) => tx.wait());

            const newAppRegistry = await new AppRegistry__factory()
                .connect(iexecAdmin)
                .deploy()
                .then((contract) => contract.waitForDeployment());

            await newAppRegistry.initialize(appRegistryAddress).then((tx) => tx.wait());
            const isRegistered = await newAppRegistry.isRegistered(appCreatedAddress);
            expect(isRegistered).to.be.true;
        });
    });

    describe('Dataset Registry', () => {
        const createDatasetArgs = [
            `Dataset`,
            MULTIADDR_BYTES,
            ethers.id(`My dataset checksum`),
        ] as [string, BytesLike, BytesLike];
        it('Should predict the correct address for future dataset creation', async () => {
            const code = await datasetRegistry.proxyCode();
            const proxyCodeHash = ethers.keccak256(code);
            const encodedInitializer = Dataset__factory.createInterface().encodeFunctionData(
                'initialize',
                createDatasetArgs,
            );
            const salt = ethers.solidityPackedKeccak256(
                ['bytes', 'address'],
                [encodedInitializer, datasetProvider.address],
            );

            const predictedAddress = ethers.getCreate2Address(
                datasetRegistryAddress,
                salt,
                proxyCodeHash,
            );
            expect(
                await datasetRegistry.predictDataset(datasetProvider.address, ...createDatasetArgs),
            ).to.equal(predictedAddress);
        });

        it('Should create the dataset and check token details', async () => {
            const initialDatasetBalance = await datasetRegistry.balanceOf(datasetProvider.address);
            expect(initialDatasetBalance).to.equal(0);

            const predictedAddress = await datasetRegistry.predictDataset(
                datasetProvider.address,
                ...createDatasetArgs,
            );
            await expect(
                await datasetRegistry.createDataset(datasetProvider.address, ...createDatasetArgs),
            )
                .to.emit(datasetRegistry, 'Transfer')
                .withArgs(ZeroAddress, datasetProvider.address, predictedAddress);
            expect(await datasetRegistry.balanceOf(datasetProvider.address)).to.equal(
                initialDatasetBalance + 1n,
            );
            expect(await datasetRegistry.ownerOf(predictedAddress)).to.equal(
                datasetProvider.address,
            );

            const tokenAtIndex = await datasetRegistry.tokenOfOwnerByIndex(
                datasetProvider.address,
                0,
            );
            expect(bigintToAddress(tokenAtIndex)).to.equal(ethers.getAddress(predictedAddress));

            const tokenURI = await datasetRegistry.tokenURI(predictedAddress);
            const baseURI = await datasetRegistry.baseURI();
            expect(tokenURI).to.equal(baseURI + BigInt(predictedAddress));
        });

        it('Should check that a new dataset is well registered', async () => {
            const datasetCreatedAddress = await datasetRegistry.createDataset.staticCall(
                datasetProvider.address,
                ...createDatasetArgs,
            );
            await datasetRegistry
                .createDataset(datasetProvider.address, ...createDatasetArgs)
                .then((tx) => tx.wait());
            const isRegistered = await datasetRegistry.isRegistered(datasetCreatedAddress);
            expect(isRegistered).to.be.true;
        });

        it('Should not have a random address registered in dataset registry', async () => {
            expect(await datasetRegistry.isRegistered(randomAddress())).to.be.false;
        });

        it('Should not allow creating the same dataset twice', async () => {
            await datasetRegistry
                .createDataset(datasetProvider.address, ...createDatasetArgs)
                .then((tx) => tx.wait());

            await expect(
                datasetRegistry.createDataset(datasetProvider.address, ...createDatasetArgs),
            ).to.be.revertedWithCustomError(appRegistry, 'Create2FailedDeployment');
        });
    });

    describe('Workerpool Registry', () => {
        const createWorkerpoolArgs = [`Workerpool description`] as [string];
        it('Should predict the correct address for future workerpool creation', async () => {
            const proxyCode = await workerpoolRegistry.proxyCode();
            const proxyCodeHash = ethers.keccak256(proxyCode);
            const encodedInitializer = Workerpool__factory.createInterface().encodeFunctionData(
                'initialize',
                createWorkerpoolArgs,
            );
            const salt = ethers.solidityPackedKeccak256(
                ['bytes', 'address'],
                [encodedInitializer, scheduler.address],
            );

            const expectedAddress = ethers.getCreate2Address(
                workerpoolRegistryAddress,
                salt,
                proxyCodeHash,
            );

            const predictedAddress = await workerpoolRegistry.predictWorkerpool(
                scheduler.address,
                ...createWorkerpoolArgs,
            );

            expect(predictedAddress).to.equal(expectedAddress);
        });

        it('Should create the workerpool and check token details', async () => {
            const initialWorkerpoolBalance = await workerpoolRegistry.balanceOf(scheduler.address);
            expect(initialWorkerpoolBalance).to.equal(0);

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
                .withArgs(ZeroAddress, scheduler.address, predictedAddress);
            expect(await workerpoolRegistry.balanceOf(scheduler.address)).to.equal(
                initialWorkerpoolBalance + 1n,
            );
            expect(await workerpoolRegistry.ownerOf(predictedAddress)).to.equal(scheduler.address);

            const tokenAtIndex = await workerpoolRegistry.tokenOfOwnerByIndex(scheduler.address, 0);
            expect(bigintToAddress(tokenAtIndex)).to.equal(ethers.getAddress(predictedAddress));

            const tokenURI = await workerpoolRegistry.tokenURI(predictedAddress);
            const baseURI = await workerpoolRegistry.baseURI();
            expect(tokenURI).to.equal(baseURI + BigInt(predictedAddress));
        });

        it('Should check that a new workerpool is well registered', async () => {
            const workerpoolCreatedAddress = await workerpoolRegistry.createWorkerpool.staticCall(
                scheduler.address,
                ...createWorkerpoolArgs,
            );
            await workerpoolRegistry
                .createWorkerpool(scheduler.address, ...createWorkerpoolArgs)
                .then((tx) => tx.wait());
            const isRegistered = await workerpoolRegistry.isRegistered(workerpoolCreatedAddress);
            expect(isRegistered).to.be.true;
        });

        it('Should not have a random address registered in workerpool registry', async () => {
            expect(await workerpoolRegistry.isRegistered(randomAddress())).to.be.false;
        });

        it('Should not allow creating the same workerpool twice', async () => {
            await workerpoolRegistry
                .createWorkerpool(scheduler.address, ...createWorkerpoolArgs)
                .then((tx) => tx.wait());

            await expect(
                workerpoolRegistry.createWorkerpool(scheduler.address, ...createWorkerpoolArgs),
            ).to.be.revertedWithCustomError(appRegistry, 'Create2FailedDeployment');
        });
    });

    describe('Common', () => {
        it('Should revert when setName is called for reverse registration', async () => {
            const randomEnsContract = randomAddress();
            const randomEnsName = 'random.eth';
            const txs = [
                appRegistryAsAdmin.setName(randomEnsContract, randomEnsName),
                datasetRegistryAsAdmin.setName(randomEnsContract, randomEnsName),
                workerpoolRegistryAsAdmin.setName(randomEnsContract, randomEnsName),
            ];
            await Promise.all(
                txs.map((tx) =>
                    expect(tx).to.be.revertedWith('Operation not supported on this chain'),
                ),
            );
        });
    });
});
