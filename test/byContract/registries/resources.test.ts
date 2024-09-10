// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { BytesLike } from '@ethersproject/bytes';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments, ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    App,
    AppRegistry,
    AppRegistry__factory,
    App__factory,
    Dataset,
    DatasetRegistry,
    DatasetRegistry__factory,
    Dataset__factory,
    ENSRegistry,
    ENSRegistry__factory,
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    PublicResolver__factory,
    ReverseRegistrar__factory,
    Workerpool,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
    Workerpool__factory,
} from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';
const constants = require('../../../utils/constants');

describe('Ressources', () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsAdmin]: IexecInterfaceNative[] = [];
    let [iexecAdmin, appProvider, datasetProvider, scheduler, anyone]: SignerWithAddress[] = [];

    let ensRegistry: ENSRegistry;
    let appRegistry: AppRegistry;
    let datasetRegistry: DatasetRegistry;
    let workerpoolRegistry: WorkerpoolRegistry;

    let app: App;
    let dataset: Dataset;
    let workerpool: Workerpool;

    beforeEach(async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        ({ iexecAdmin, appProvider, datasetProvider, scheduler, anyone } =
            await getIexecAccounts());
        const ensRegistryAddress = (await deployments.get('ENSRegistry')).address;
        ensRegistry = ENSRegistry__factory.connect(ensRegistryAddress, anyone);

        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsAdmin = iexecPoco.connect(iexecAdmin);

        appRegistry = AppRegistry__factory.connect(await iexecPoco.appregistry(), anyone);
        datasetRegistry = DatasetRegistry__factory.connect(
            await iexecPoco.datasetregistry(),
            anyone,
        );
        workerpoolRegistry = WorkerpoolRegistry__factory.connect(
            await iexecPoco.workerpoolregistry(),
            anyone,
        );
    }

    describe('App', () => {
        const createAppArgs = [
            `App`,
            'DOCKER',
            constants.MULTIADDR_BYTES,
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Content of my app`)),
            '0x1234',
        ] as [string, string, BytesLike, BytesLike, BytesLike];

        beforeEach(async () => {
            const appAddress = await appRegistry.callStatic.createApp(
                appProvider.address,
                ...createAppArgs,
            );
            await appRegistry.createApp(appProvider.address, ...createAppArgs);
            app = App__factory.connect(appAddress, appProvider);
        });

        it('should create an app and verify its details', async () => {
            expect(await app.registry()).to.equal(appRegistry.address);
            expect(await app.owner()).to.equal(appProvider.address);
            expect(await app.m_appName()).to.equal(createAppArgs[0]);
            expect(await app.m_appType()).to.equal(createAppArgs[1]);
            expect(await app.m_appMultiaddr()).to.equal(createAppArgs[2]);
            expect(await app.m_appChecksum()).to.equal(createAppArgs[3]);
            expect(await app.m_appMREnclave()).to.equal(createAppArgs[4]);
        });
        it('should set the ENS name for the app', async () => {
            const newENSName = 'myApp.eth';
            const reverseRootNameHash = ethers.utils.namehash('addr.reverse');
            const reverseRegistrarAddress = await ensRegistry.owner(reverseRootNameHash);
            const reverseResolverAddress = await ReverseRegistrar__factory.connect(
                reverseRegistrarAddress,
                anyone,
            ).defaultResolver();
            const reverseResolver = PublicResolver__factory.connect(reverseResolverAddress, anyone);

            await app.setName(ensRegistry.address, newENSName);

            const nameHash = ethers.utils.namehash(`${app.address.substring(2)}.addr.reverse`);
            expect(await reverseResolver.name(nameHash)).to.equal(newENSName);
        });

        it('should revert when a non-owner tries to set the ENS name', async () => {
            const newENSName = 'unauthorized.eth';
            await expect(
                app.connect(anyone).setName(ensRegistry.address, newENSName),
            ).to.be.revertedWith('caller is not the owner');
        });
    });

    describe('Dataset', () => {
        const createDatasetArgs = [
            `Dataset`,
            constants.MULTIADDR_BYTES,
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Content of my dataset`)),
        ] as [string, BytesLike, BytesLike];
        it('should create a dataset and verify its details', async () => {
            const datasetAddress = await datasetRegistry.callStatic.createDataset(
                datasetProvider.address,
                ...createDatasetArgs,
            );
            await datasetRegistry.createDataset(datasetProvider.address, ...createDatasetArgs);
            dataset = Dataset__factory.connect(datasetAddress, datasetProvider);
            expect(await dataset.owner()).to.equal(datasetProvider.address);
            expect(await dataset.m_datasetName()).to.equal(createDatasetArgs[0]);
            expect(await dataset.m_datasetMultiaddr()).to.equal(createDatasetArgs[1]);
            expect(await dataset.m_datasetChecksum()).to.equal(createDatasetArgs[2]);
        });
    });

    describe('Workerpool', () => {
        const createWorkerpoolArgs = [`Workerpool description`] as [string];

        beforeEach(async () => {
            const workerpoolAddress = await workerpoolRegistry.callStatic.createWorkerpool(
                scheduler.address,
                ...createWorkerpoolArgs,
            );
            await workerpoolRegistry.createWorkerpool(scheduler.address, ...createWorkerpoolArgs);
            workerpool = Workerpool__factory.connect(workerpoolAddress, scheduler);
        });

        it('should create a workerpool and verify its details', async () => {
            expect(await workerpool.owner()).to.equal(scheduler.address);
            expect(await workerpool.m_workerpoolDescription()).to.equal(createWorkerpoolArgs[0]);
            expect(await workerpool.m_workerStakeRatioPolicy()).to.equal(30);
            expect(await workerpool.m_schedulerRewardRatioPolicy()).to.equal(1);
        });

        it('should allow the owner to configure the workerpool', async () => {
            await workerpool.changePolicy(35, 5, { from: scheduler.address });
            expect(await workerpool.m_workerStakeRatioPolicy()).to.equal(35);
            expect(await workerpool.m_schedulerRewardRatioPolicy()).to.equal(5);
        });

        it('should reject configuration from non-owner', async () => {
            await expect(
                workerpool.connect(anyone).changePolicy(0, 0, { from: anyone.address }),
            ).to.be.revertedWith('caller is not the owner');
        });

        it('should reject invalid configuration', async () => {
            await expect(
                workerpool.changePolicy(100, 150, { from: scheduler.address }),
            ).to.be.revertedWithoutReason();
        });
    });
});
