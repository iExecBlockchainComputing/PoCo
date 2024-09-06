// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { BytesLike } from '@ethersproject/bytes';

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments, ethers } from 'hardhat';
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
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
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

    describe('App', async () => {
        const createAppArgs = [
            `App`,
            'DOCKER',
            constants.MULTIADDR_BYTES,
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Content of my app`)),
            '0x1234',
        ] as [string, string, BytesLike, BytesLike, BytesLike];
        const appAddress = await appRegistry.callStatic.createApp(
            appProvider.address,
            ...createAppArgs,
        );
        await appRegistry.createApp(appProvider.address, ...createAppArgs);
        app = App__factory.connect(appAddress, appProvider);

        it('', async () => {});
    });

    describe('Dataset', async () => {
        const createDatasetArgs = [
            `Dataset`,
            constants.MULTIADDR_BYTES,
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Content of my dataset`)),
        ] as [string, BytesLike, BytesLike];
        const datasetAddress = await datasetRegistry.callStatic.createDataset(
            datasetProvider.address,
            ...createDatasetArgs,
        );
        // Create the dataset
        await datasetRegistry.createDataset(datasetProvider.address, ...createDatasetArgs);
        // Connect to the dataset and verify
        dataset = Dataset__factory.connect(datasetAddress, datasetProvider);
        it('', async () => {});
    });

    describe('Workerpool', async () => {
        const createWorkerpoolArgs = [`Workerpool description`] as [string];
        const workerpoolAddress = await workerpoolRegistry.callStatic.createWorkerpool(
            scheduler.address,
            ...createWorkerpoolArgs,
        );
        // Create the workerpool
        await workerpoolRegistry.createWorkerpool(scheduler.address, ...createWorkerpoolArgs);
        // Connect to the workerpool and verify
        workerpool = Workerpool__factory.connect(workerpoolAddress, scheduler);
        it('', async () => {});
    });
});
