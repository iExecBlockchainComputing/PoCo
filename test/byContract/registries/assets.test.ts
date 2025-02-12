// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { BytesLike } from '@ethersproject/bytes';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { deployments, ethers } from 'hardhat';
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
    PublicResolver,
    PublicResolver__factory,
    ReverseRegistrar__factory,
    Workerpool,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
    Workerpool__factory,
} from '../../../typechain';
import { MULTIADDR_BYTES } from '../../../utils/constants';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';

describe('Assets', () => {
    let proxyAddress: string;
    let iexecPoco: IexecInterfaceNative;
    let [appProvider, datasetProvider, scheduler, anyone]: SignerWithAddress[] = [];

    let ensRegistry: ENSRegistry;
    let reverseResolver: PublicResolver;
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
        ({ appProvider, datasetProvider, scheduler, anyone } = await getIexecAccounts());
        const ensRegistryAddress = (await deployments.get('ENSRegistry')).address;

        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);

        appRegistry = AppRegistry__factory.connect(await iexecPoco.appregistry(), anyone);
        datasetRegistry = DatasetRegistry__factory.connect(
            await iexecPoco.datasetregistry(),
            anyone,
        );
        workerpoolRegistry = WorkerpoolRegistry__factory.connect(
            await iexecPoco.workerpoolregistry(),
            anyone,
        );

        ensRegistry = ENSRegistry__factory.connect(ensRegistryAddress, anyone);
        const reverseRootNameHash = ethers.utils.namehash('addr.reverse');
        const reverseRegistrarAddress = await ensRegistry.owner(reverseRootNameHash);
        const reverseResolverAddress = await ReverseRegistrar__factory.connect(
            reverseRegistrarAddress,
            anyone,
        ).defaultResolver();
        reverseResolver = PublicResolver__factory.connect(reverseResolverAddress, anyone);
    }

    describe('App', () => {
        const createAppParams = {
            name: 'My app',
            type: 'DOCKER',
            multiaddr: MULTIADDR_BYTES,
            checksum: ethers.utils.id('My app checksum'),
            mreclave: '0x1234',
        };
        const createAppArgs = Object.values(createAppParams) as [
            string,
            string,
            BytesLike,
            BytesLike,
            BytesLike,
        ];
        beforeEach(async () => {
            const appAddress = await appRegistry.callStatic.createApp(
                appProvider.address,
                ...createAppArgs,
            );
            await appRegistry
                .createApp(appProvider.address, ...createAppArgs)
                .then((tx) => tx.wait());
            app = App__factory.connect(appAddress, anyone);
        });

        describe('creation and initialization', () => {
            it('Should read initialized app details', async () => {
                expect(await app.registry()).to.equal(appRegistry.address);
                expect(await app.owner()).to.equal(appProvider.address);
                expect(await app.m_appName()).to.equal(createAppParams.name);
                expect(await app.m_appType()).to.equal(createAppParams.type);
                expect(await app.m_appMultiaddr()).to.equal(createAppParams.multiaddr);
                expect(await app.m_appChecksum()).to.equal(createAppParams.checksum);
                expect(await app.m_appMREnclave()).to.equal(createAppParams.mreclave);
            });

            it('Should not reinitialize created app', async () => {
                await expect(app.initialize(...createAppArgs)).to.be.revertedWith(
                    'already initialized',
                );
            });
        });

        describe('setName', () => {
            it('Should set name for the ENS reverse registration of the app', async () => {
                const newENSName = 'myApp.eth';
                await app
                    .connect(appProvider)
                    .setName(ensRegistry.address, newENSName)
                    .then((tx) => tx.wait());
                expect(await reverseResolver.name(computeNameHash(app.address))).to.equal(
                    newENSName,
                );
            });

            it('Should not set name when send is not the owner', async () => {
                const newENSName = 'unauthorized.eth';
                await expect(app.setName(ensRegistry.address, newENSName)).to.be.revertedWith(
                    'caller is not the owner',
                );
            });
        });
    });

    describe('Dataset', () => {
        const createDatasetParams = {
            name: 'My dataset',
            multiaddr: MULTIADDR_BYTES,
            checksum: ethers.utils.id('My dataset checksum'),
        };
        const createDatasetArgs = Object.values(createDatasetParams) as [
            string,
            BytesLike,
            BytesLike,
        ];
        beforeEach(async () => {
            const datasetAddress = await datasetRegistry.callStatic.createDataset(
                datasetProvider.address,
                ...createDatasetArgs,
            );
            await datasetRegistry
                .createDataset(datasetProvider.address, ...createDatasetArgs)
                .then((tx) => tx.wait());
            dataset = Dataset__factory.connect(datasetAddress, anyone);
        });

        describe('creation and initialization', () => {
            it('Should read initialized dataset details', async () => {
                expect(await dataset.registry()).to.equal(datasetRegistry.address);
                expect(await dataset.owner()).to.equal(datasetProvider.address);
                expect(await dataset.m_datasetName()).to.equal(createDatasetParams.name);
                expect(await dataset.m_datasetMultiaddr()).to.equal(createDatasetParams.multiaddr);
                expect(await dataset.m_datasetChecksum()).to.equal(createDatasetParams.checksum);
            });

            it('Should not reinitialize created dataset', async () => {
                await expect(dataset.initialize(...createDatasetArgs)).to.be.revertedWith(
                    'already initialized',
                );
            });
        });

        describe('setName', () => {
            it('Should set name for the ENS reverse registration of the dataset', async () => {
                const newENSName = 'myDataset.eth';
                await dataset
                    .connect(datasetProvider)
                    .setName(ensRegistry.address, newENSName)
                    .then((tx) => tx.wait());
                expect(await reverseResolver.name(computeNameHash(dataset.address))).to.equal(
                    newENSName,
                );
            });

            it('Should not set name when send is not the owner', async () => {
                const newENSName = 'unauthorized.eth';
                await expect(dataset.setName(ensRegistry.address, newENSName)).to.be.revertedWith(
                    'caller is not the owner',
                );
            });
        });
    });

    describe('Workerpool', () => {
        const createWorkerpoolParams = {
            description: 'Workerpool description',
        };
        const createWorkerpoolArgs = Object.values(createWorkerpoolParams) as [string];
        beforeEach(async () => {
            const workerpoolAddress = await workerpoolRegistry.callStatic.createWorkerpool(
                scheduler.address,
                ...createWorkerpoolArgs,
            );
            await workerpoolRegistry
                .createWorkerpool(scheduler.address, ...createWorkerpoolArgs)
                .then((tx) => tx.wait());
            workerpool = Workerpool__factory.connect(workerpoolAddress, anyone);
        });

        describe('creation and initialization', () => {
            it('Should read initialized workerpool details', async () => {
                expect(await workerpool.registry()).to.equal(workerpoolRegistry.address);
                expect(await workerpool.owner()).to.equal(scheduler.address);
                expect(await workerpool.m_workerpoolDescription()).to.equal(
                    createWorkerpoolParams.description,
                );
                expect(await workerpool.m_workerStakeRatioPolicy()).to.equal(30);
                expect(await workerpool.m_schedulerRewardRatioPolicy()).to.equal(1);
            });

            it('Should not reinitialize created workerpool', async () => {
                await expect(workerpool.initialize(...createWorkerpoolArgs)).to.be.revertedWith(
                    'already initialized',
                );
            });
        });

        describe('setName', () => {
            it('Should set name for the ENS reverse registration of the workerpool', async () => {
                const newENSName = 'myWorkerpool.eth';
                await workerpool
                    .connect(scheduler)
                    .setName(ensRegistry.address, newENSName)
                    .then((tx) => tx.wait());
                expect(await reverseResolver.name(computeNameHash(workerpool.address))).to.equal(
                    newENSName,
                );
            });

            it('Should not set name when send is not the owner', async () => {
                const newENSName = 'unauthorized.eth';
                await expect(
                    workerpool.setName(ensRegistry.address, newENSName),
                ).to.be.revertedWith('caller is not the owner');
            });
        });

        describe('changePolicy', () => {
            it('Should update workerpool policy configuration', async () => {
                const previousWorkerStakeRatioPolicy = await workerpool.m_workerStakeRatioPolicy();
                const previousSchedulerRewardRatioPolicy =
                    await workerpool.m_schedulerRewardRatioPolicy();
                await expect(
                    await workerpool
                        .connect(scheduler)
                        .changePolicy(35, 5, { from: scheduler.address }),
                )
                    .to.emit(workerpool, 'PolicyUpdate')
                    .withArgs(
                        previousWorkerStakeRatioPolicy,
                        35,
                        previousSchedulerRewardRatioPolicy,
                        5,
                    );
                expect(await workerpool.m_workerStakeRatioPolicy()).to.equal(35);
                expect(await workerpool.m_schedulerRewardRatioPolicy()).to.equal(5);
            });

            it('Should not update policy configuration when sender is not the owner', async () => {
                await expect(
                    workerpool.changePolicy(0, 0, { from: anyone.address }),
                ).to.be.revertedWith('caller is not the owner');
            });

            it('Should reject invalid configuration', async () => {
                await expect(
                    workerpool
                        .connect(scheduler)
                        .changePolicy(100, 150, { from: scheduler.address }),
                ).to.be.revertedWithoutReason();
            });
        });
    });

    const computeNameHash = (address: string) =>
        ethers.utils.namehash(`${address.substring(2)}.addr.reverse`);
});
