// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import hre, { deployments, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    App,
    AppRegistry,
    AppRegistry__factory,
    Dataset,
    DatasetRegistry,
    DatasetRegistry__factory,
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    Workerpool,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
} from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';
const CONFIG = require('../../../config/config.json');

describe('Registries', () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsAdmin]: IexecInterfaceNative[] = [];
    let [iexecAdmin, appProvider, datasetProvider, scheduler, anyone]: SignerWithAddress[] = [];
    let iexecWrapper: IexecWrapper;

    let ensRegistryAddress: string;

    let appRegistry: AppRegistry;
    let datasetRegistry: DatasetRegistry;
    let workerpoolRegistry: WorkerpoolRegistry;

    let Apps: App[];
    let Datasets: Dataset[];
    let Workerpools: Workerpool[];

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
        it('Should retreive base URI', async () => {
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
        it('Should not reinitialize', async () => {
            await expect(appRegistry.initialize(AddressZero)).to.be.revertedWithoutReason();
            await expect(datasetRegistry.initialize(AddressZero)).to.be.revertedWithoutReason();
            await expect(workerpoolRegistry.initialize(AddressZero)).to.be.revertedWithoutReason();
        });
    });
});
