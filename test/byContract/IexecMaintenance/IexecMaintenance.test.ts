// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, setStorageAt } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { TypedDataEncoder, ZeroHash } from 'ethers';
import { ethers } from 'hardhat';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    IexecLibOrders_v5,
    IexecMaintenanceExtra,
    IexecMaintenanceExtra__factory,
} from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';
import { hashDomain } from '../../utils/utils';

const randomAddress = () => ethers.Wallet.createRandom().address;
const configureParams = {
    token: randomAddress(),
    name: 'some name',
    symbol: 'some symbol',
    decimals: 100,
    appregistry: randomAddress(),
    datasetregistry: randomAddress(),
    workerpoolregistry: randomAddress(),
    m_v3_iexecHub: randomAddress(),
};
const configureArgs = Object.values(configureParams) as [
    string,
    string,
    string,
    number,
    string,
    string,
    string,
    string,
];
const someDomainSeparator = '0x0000000000000000000000000000000000000000000000000000000000000001';

describe('IexecMaintenance', async () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsAdmin]: IexecInterfaceNative[] = [];
    let iexecMaintenanceExtra: IexecMaintenanceExtra;
    let [iexecAdmin, worker, anyone]: SignerWithAddress[] = [];

    beforeEach('Deploy', async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ iexecAdmin, worker, anyone } = accounts);
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsAdmin = iexecPoco.connect(iexecAdmin);
        iexecMaintenanceExtra = IexecMaintenanceExtra__factory.connect(proxyAddress, anyone);
    }

    describe('Configure', () => {
        it('Should configure', async () => {
            await clearDomainSeparator();
            await iexecPocoAsAdmin.configure(...configureArgs).then((tx) => tx.wait());
            expect(await iexecPoco.eip712domain_separator()).equal(
                await hashDomain(await iexecPoco.domain()),
            );
            expect(await iexecPoco.token()).equal(configureParams.token);
            expect(await iexecPoco.name()).equal(configureParams.name);
            expect(await iexecPoco.symbol()).equal(configureParams.symbol);
            expect(await iexecPoco.decimals()).equal(configureParams.decimals);
            expect(await iexecPoco.appregistry()).equal(configureParams.appregistry);
            expect(await iexecPoco.datasetregistry()).equal(configureParams.datasetregistry);
            expect(await iexecPoco.workerpoolregistry()).equal(configureParams.workerpoolregistry);
            // no getter for m_v3_iexecHub
            expect(await iexecPoco.callbackgas()).equal(100000);
        });
        it('Should not configure when sender is not owner', async () => {
            await expect(iexecPoco.configure(...configureArgs)).to.be.revertedWith(
                'Ownable: caller is not the owner',
            );
        });
        it('Should not configure when already configured', async () => {
            await expect(iexecPocoAsAdmin.configure(...configureArgs)).to.be.revertedWith(
                'already-configured',
            );
        });
    });

    describe('Get domain', () => {
        it('Should get domain', async () => {
            const domain = await iexecPoco.domain();
            expect(domain.name).equal('iExecODB');
            expect(domain.version).equal('5.0.0');
            expect(domain.chainId).equal((await ethers.provider.getNetwork()).chainId);
            expect(domain.verifyingContract).equal(proxyAddress);
        });
    });

    describe('Update domain separator', () => {
        it('Should update domain separator', async () => {
            await setDomainSeparatorInStorage(someDomainSeparator);
            expect(await iexecPoco.eip712domain_separator()).equal(someDomainSeparator);
            await iexecPoco.updateDomainSeparator().then((tx) => tx.wait());
            expect(await iexecPoco.eip712domain_separator()).equal(
                await hashDomain(await iexecPoco.domain()),
            );
        });
        it('Should not update domain separator when not configured', async () => {
            await clearDomainSeparator();
            await expect(iexecPoco.updateDomainSeparator()).to.be.revertedWith('not-configured');
        });
    });

    describe('Import score', () => {
        it('[TODO] Should import score', async () => {
            // Not tested
        });
        it('Should not import score when no v3_iexecHub configured', async () => {
            await expect(iexecPoco.importScore(worker.address)).to.be.revertedWithoutReason();
        });
        it('Should not import score when already imported', async () => {
            const workerScoreImportedSlot = ethers.stripZerosLeft(
                ethers.keccak256(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ['address', 'uint256'],
                        [
                            worker.address,
                            28, // Slot index of m_v3_scoreImported in Store
                        ],
                    ),
                ),
            );
            await setStorageAt(
                proxyAddress,
                workerScoreImportedSlot,
                '0x01', // true: score already imported
            );
            await expect(iexecPoco.importScore(worker.address)).to.be.revertedWith(
                'score-already-imported',
            );
        });
    });

    describe('Set TEE broker', () => {
        it('Should set TEE broker', async () => {
            const teeBrokerAddress = randomAddress();
            await iexecPocoAsAdmin.setTeeBroker(teeBrokerAddress).then((tx) => tx.wait());
            expect(await iexecPoco.teebroker()).equal(teeBrokerAddress);
        });

        it('Should not set TEE broker when sender is not the owner', async () => {
            await expect(iexecPoco.setTeeBroker(randomAddress())).to.be.revertedWith(
                'Ownable: caller is not the owner',
            );
        });
    });

    describe('Set callback gas', () => {
        const callbackGas = 1;

        it('Should set callback gas', async () => {
            await iexecPocoAsAdmin.setCallbackGas(callbackGas).then((tx) => tx.wait());
            expect(await iexecPoco.callbackgas()).equal(callbackGas);
        });

        it('Should not set callback gas when sender is not the owner', async () => {
            await expect(iexecPoco.setCallbackGas(callbackGas)).to.be.revertedWith(
                'Ownable: caller is not the owner',
            );
        });
    });

    describe('Change registries', () => {
        it('Should change registries', async () => {
            const appRegistry = randomAddress();
            const datasetRegistry = randomAddress();
            const workerpoolRegistry = randomAddress();
            await iexecMaintenanceExtra
                .connect(iexecAdmin)
                .changeRegistries(appRegistry, datasetRegistry, workerpoolRegistry)
                .then((tx) => tx.wait());
            expect(await iexecPoco.appregistry()).equal(appRegistry);
            expect(await iexecPoco.datasetregistry()).equal(datasetRegistry);
            expect(await iexecPoco.workerpoolregistry()).equal(workerpoolRegistry);
        });

        it('Should not change registries when sender is not the owner', async () => {
            await expect(
                iexecMaintenanceExtra.changeRegistries(
                    randomAddress(),
                    randomAddress(),
                    randomAddress(),
                ),
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
    });

    async function clearDomainSeparator() {
        await setDomainSeparatorInStorage(ZeroHash);
    }

    async function setDomainSeparatorInStorage(domainSeparator: string) {
        await setStorageAt(
            proxyAddress,
            '0x10', // Slot index of EIP712DOMAIN_SEPARATOR in Store
            domainSeparator,
        );
        // Double check the update of the domain separator happened
        expect(await iexecPoco.eip712domain_separator()).equal(domainSeparator);
    }
});
