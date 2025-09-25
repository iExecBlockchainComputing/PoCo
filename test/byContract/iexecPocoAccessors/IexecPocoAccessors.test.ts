// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ZeroAddress, ZeroHash } from 'ethers';
import { deployments, ethers } from 'hardhat';
import {
    AppRegistry,
    AppRegistry__factory,
    DatasetRegistry,
    DatasetRegistry__factory,
    IexecAccessors__factory,
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    IexecLibOrders_v5,
} from '../../../typechain';
import {
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    createOrderOperation,
} from '../../../utils/createOrders';
import {
    ContributionStatusEnum,
    OrderOperationEnum,
    TaskStatusEnum,
    buildResultCallbackAndDigest,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
    getTaskId,
} from '../../../utils/poco-tools';
import { IexecWrapper, extractRegistryEntryAddress } from '../../utils/IexecWrapper';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';
import { hashDomain, randomAddress } from '../../utils/utils';

/**
 * Test state view functions.
 */

// Asset test data constants
const APP_MULTIADDR = '0x68656c6c6f20776f726c64'; // "hello world" in hex
const APP_CHECKSUM = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const APP_MR_ENCLAVE = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const DATASET_MULTIADDR = '0x646174617365742064617461'; // "dataset data" in hex
const DATASET_CHECKSUM = '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321';

const appPrice = 1000n;
const datasetPrice = 1_000_000n;
const workerpoolPrice = 1_000_000_000n;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);

let proxyAddress: string;
let iexecPoco: IexecInterfaceNative;
let iexecWrapper: IexecWrapper;
let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
let [appAddressWithData, datasetAddressWithData]: string[] = [];
let [requester, appProvider, datasetProvider, scheduler, worker1, anyone]: SignerWithAddress[] = [];
let ordersAssets: OrdersAssets;
let ordersPrices: OrdersPrices;

describe('IexecPocoAccessors', async () => {
    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ requester, appProvider, datasetProvider, scheduler, worker1, anyone } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        appAddressWithData = await createAppWithData();
        datasetAddressWithData = await createDatasetWithData();
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, ethers.provider);
        ordersAssets = {
            app: appAddress,
            dataset: datasetAddress,
            workerpool: workerpoolAddress,
        };
        ordersPrices = {
            app: appPrice,
            dataset: datasetPrice,
            workerpool: workerpoolPrice,
        };
    }

    it('name', async function () {
        expect(await iexecPoco.name()).to.equal('Staked RLC');
    });

    it('symbol', async function () {
        expect(await iexecPoco.symbol()).to.equal('SRLC');
    });

    it('decimals', async function () {
        expect(await iexecPoco.decimals()).to.equal(9n);
    });

    it('totalSupply', async function () {
        expect(await iexecPoco.totalSupply()).to.equal(0n);
    });

    it('balanceOf', async function () {
        const amount = 3n;
        await iexecWrapper.depositInIexecAccount(anyone, amount);
        expect(await iexecPoco.balanceOf(anyone.address)).to.equal(amount);
    });

    it('frozenOf', async function () {
        await createDeal(); // Lock some requester funds.
        const dealPrice = appPrice + datasetPrice + workerpoolPrice; // volume == 1
        expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealPrice);
    });

    it('allowance', async function () {
        const amount = 10n;
        const spender = randomAddress();
        await iexecWrapper.depositInIexecAccount(anyone, amount);
        await iexecPoco.connect(anyone).approve(spender, amount);
        expect(await iexecPoco.allowance(anyone.address, spender)).to.equal(amount);
    });

    it('viewAccount', async function () {
        await createDeal(); // Lock some requester funds.
        const dealPrice = appPrice + datasetPrice + workerpoolPrice;
        // Stake some funds.
        const stakedBalance = 3n;
        await iexecWrapper.depositInIexecAccount(requester, stakedBalance);
        // Check staked and locked amounts.
        const account = await iexecPoco.viewAccount(requester.address);
        expect(account.stake).to.equal(stakedBalance);
        expect(account.locked).to.equal(dealPrice);
    });

    // TODO test the case where token() == 0x0 in native mode.
    it('token', async function () {
        expect(await iexecPoco.token()).to.equal((await deployments.get('RLC')).address);
    });

    it('viewDeal', async function () {
        const { dealId } = await createDeal();
        const deal = await iexecPoco.viewDeal(dealId);
        expect(deal.app.pointer).to.equal(appAddress);
        expect(deal.app.owner).to.equal(appProvider.address);
        expect(deal.app.price).to.equal(appPrice);
        expect(deal.dataset.pointer).to.equal(datasetAddress);
        expect(deal.dataset.owner).to.equal(datasetProvider.address);
        expect(deal.dataset.price).to.equal(datasetPrice);
        expect(deal.workerpool.pointer).to.equal(workerpoolAddress);
        expect(deal.workerpool.owner).to.equal(scheduler.address);
        expect(deal.workerpool.price).to.equal(workerpoolPrice);
        expect(deal.trust).to.equal(1);
        expect(deal.category).to.equal(0);
        expect(deal.tag).to.equal(ZeroHash); // Standard
        expect(deal.requester).to.equal(requester.address);
        expect(deal.beneficiary).to.equal(ZeroAddress);
        expect(deal.callback).to.equal(ZeroAddress);
        expect(deal.params).to.equal('');
        expect(deal.startTime).to.be.greaterThan(0);
        expect(deal.botFirst).to.equal(0);
        expect(deal.botSize).to.equal(1);
        expect(deal.workerStake).to.be.greaterThan(0);
        expect(deal.schedulerRewardRatio).to.be.greaterThan(0);
        expect(deal.sponsor).to.equal(requester.address);
    });

    it('viewConsumed', async function () {
        const { orders } = await createDeal();
        expect(await iexecPoco.viewConsumed(iexecWrapper.hashOrder(orders.app))).to.equal(1);
    });

    it('viewPresigned', async function () {
        const appOrder = buildOrders({ assets: ordersAssets, requester: requester.address }).app;
        const orderOperation = createOrderOperation(appOrder, OrderOperationEnum.SIGN);
        await iexecWrapper.signOrderOperation(orderOperation, appProvider);
        await iexecPoco
            .connect(appProvider)
            .manageAppOrder(orderOperation)
            .then((tx) => tx.wait());
        expect(await iexecPoco.viewPresigned(iexecWrapper.hashOrder(appOrder))).equal(
            appProvider.address,
        );
    });

    it('viewTask', async function () {
        const { dealId, taskId, taskIndex, startTime, timeRef } = await createDeal();
        await iexecWrapper.initializeTask(dealId, taskIndex);

        const contributionDeadlineRatio = await iexecPoco.contribution_deadline_ratio();
        const finalDeadlineRatio = await iexecPoco.final_deadline_ratio();

        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.ACTIVE);
        expect(task.dealid).to.equal(dealId);
        expect(task.idx).to.equal(taskIndex);
        expect(task.timeref).to.equal(timeRef);
        expect(task.contributionDeadline).to.equal(startTime + timeRef * contributionDeadlineRatio);
        expect(task.revealDeadline).to.equal(0);
        expect(task.finalDeadline).to.equal(startTime + timeRef * finalDeadlineRatio);
        expect(task.consensusValue).to.equal(ZeroHash);
        expect(task.revealCounter).to.equal(0);
        expect(task.winnerCounter).to.equal(0);
        expect(task.contributors.length).to.equal(0);
        expect(task.resultDigest).to.equal(ZeroHash);
        expect(task.results).to.equal('0x');
        expect(task.resultsTimestamp).to.equal(0);
        expect(task.resultsCallback).to.equal('0x');
    });

    it('viewContribution', async function () {
        const { dealId, taskIndex, taskId } = await createDeal();
        await iexecWrapper.initializeTask(dealId, taskIndex);
        await iexecWrapper.contributeToTask(dealId, taskIndex, resultDigest, worker1);
        const contribution = await iexecPoco.viewContribution(taskId, worker1.address);
        expect(contribution.status).to.equal(ContributionStatusEnum.CONTRIBUTED);
        expect(contribution.resultHash.length).to.equal(66);
        expect(contribution.resultSeal.length).to.equal(66);
        expect(contribution.enclaveChallenge).to.equal(ZeroAddress);
        expect(contribution.weight).to.equal(1);
    });

    it.skip('[TODO] viewScore', async function () {
        expect(await iexecPoco.viewScore(worker1.address)).to.equal(0);
    });

    it('countCategory', async function () {
        expect(await iexecPoco.countCategory()).to.equal(5);
    });

    it('appRegistry', async function () {
        expect(await iexecPoco.appregistry()).to.equal(
            (await deployments.get('AppRegistry')).address,
        );
    });

    it('datasetRegistry', async function () {
        expect(await iexecPoco.datasetregistry()).to.equal(
            (await deployments.get('DatasetRegistry')).address,
        );
    });

    it('workerpoolRegistry', async function () {
        expect(await iexecPoco.workerpoolregistry()).to.equal(
            (await deployments.get('WorkerpoolRegistry')).address,
        );
    });

    it('teeBroker', async function () {
        expect(await iexecPoco.teebroker()).to.equal(ZeroAddress);
    });

    it('callbackGas', async function () {
        expect(await iexecPoco.callbackgas()).to.equal(100_000n);
    });

    it('viewDataset', async function () {
        const datasetInfo = await iexecPoco.viewDataset(datasetAddressWithData);
        expect(datasetInfo.owner).to.equal(datasetProvider.address);
        expect(datasetInfo.m_datasetName).to.equal('my-dataset');
        expect(datasetInfo.m_datasetMultiaddr).to.equal(DATASET_MULTIADDR);
        expect(datasetInfo.m_datasetChecksum).to.equal(DATASET_CHECKSUM);
    });

    it('viewApp', async function () {
        const appInfo = await iexecPoco.viewApp(appAddressWithData);
        expect(appInfo.owner).to.equal(appProvider.address);
        expect(appInfo.m_appName).to.equal('my-app');
        expect(appInfo.m_appType).to.equal('APP_TYPE_0');
        expect(appInfo.m_appMultiaddr).to.equal(APP_MULTIADDR);
        expect(appInfo.m_appChecksum).to.equal(APP_CHECKSUM);
        expect(appInfo.m_appMREnclave).to.equal(APP_MR_ENCLAVE);
    });

    it('viewWorkerpool', async function () {
        const workerpoolInfo = await iexecPoco.viewWorkerpool(workerpoolAddress);
        expect(workerpoolInfo.owner).to.equal(scheduler.address);
        expect(workerpoolInfo.m_workerpoolDescription).to.equal('my-workerpool');
        expect(workerpoolInfo.m_workerStakeRatioPolicy).to.equal(30n);
        expect(workerpoolInfo.m_schedulerRewardRatioPolicy).to.equal(1n);
    });

    it('contributionDeadlineRatio', async function () {
        expect(await iexecPoco.contribution_deadline_ratio()).to.equal(7);
    });

    it('revealDeadlineRatio', async function () {
        expect(await iexecPoco.reveal_deadline_ratio()).to.equal(2n);
    });

    it('finalDeadlineRatio', async function () {
        expect(await iexecPoco.final_deadline_ratio()).to.equal(10n);
    });

    it('workerpoolStakeRatio', async function () {
        expect(await iexecPoco.workerpool_stake_ratio()).to.equal(30n);
    });

    it('kittyRatio', async function () {
        expect(await iexecPoco.kitty_ratio()).to.equal(10n);
    });

    it('kittyMin', async function () {
        expect(await iexecPoco.kitty_min()).to.equal(1_000_000_000n);
    });

    it('kittyAddress', async function () {
        expect(await iexecPoco.kitty_address()).to.equal(
            '0x99c2268479b93fDe36232351229815DF80837e23',
        );
    });

    it('groupMemberPurpose', async function () {
        expect(await iexecPoco.groupmember_purpose()).to.equal(4n);
    });

    it('eip712domainSeparator', async function () {
        expect(await iexecPoco.eip712domain_separator()).equal(
            await hashDomain({
                // TODO use IexecWrapper.getDomain() (with some modifications).
                name: 'iExecODB',
                version: '5.0.0',
                chainId: (await ethers.provider.getNetwork()).chainId,
                // address is different between `test` and `coverage` deployment
                verifyingContract: proxyAddress,
            } as IexecLibOrders_v5.EIP712DomainStructOutput),
        );
    });

    describe('resultFor', () => {
        it('Should get result of task', async function () {
            const { dealId, taskId, taskIndex } = await createDeal();

            await iexecWrapper
                .initializeTask(dealId, taskIndex)
                .then(() =>
                    iexecWrapper.contributeToTask(dealId, taskIndex, callbackResultDigest, worker1),
                );
            await iexecPoco
                .connect(worker1)
                .reveal(taskId, callbackResultDigest)
                .then((tx) => tx.wait());
            await iexecPoco
                .connect(scheduler)
                .finalize(taskId, results, resultsCallback)
                .then((tx) => tx.wait());
            const task = await iexecPoco.viewTask(taskId);
            expect(task.status).to.equal(TaskStatusEnum.COMPLETED);
            expect(await iexecPoco.resultFor(taskId)).to.equal(resultsCallback);
        });

        it('Should not get result when task is not completed', async function () {
            const { dealId } = await createDeal(3n);

            const unsetTaskId = getTaskId(dealId, 0n);
            const activeTaskId = await iexecWrapper.initializeTask(dealId, 1n);
            const { taskId: revealingTaskId } = await iexecWrapper
                .initializeTask(dealId, 2n)
                .then(() => iexecWrapper.contributeToTask(dealId, 2n, resultDigest, worker1));

            await verifyTaskStatusAndResult(unsetTaskId, TaskStatusEnum.UNSET);
            await verifyTaskStatusAndResult(activeTaskId, TaskStatusEnum.ACTIVE);
            await verifyTaskStatusAndResult(revealingTaskId, TaskStatusEnum.REVEALING);
        });
    });
});

/**
 * Helper function to create a deal with a specific volume.
 */
async function createDeal(volume: bigint = 1n) {
    const orders = buildOrders({
        assets: ordersAssets,
        prices: ordersPrices,
        requester: requester.address,
        volume,
    });
    const { dealId, taskId, taskIndex, startTime } = await iexecWrapper.signAndMatchOrders(
        ...orders.toArray(),
    );
    const dealCategory = (await iexecPoco.viewDeal(dealId)).category;
    const timeRef = (await iexecPoco.viewCategory(dealCategory)).workClockTimeRef;
    return { dealId, taskId, taskIndex, startTime, timeRef, orders };
}

async function verifyTaskStatusAndResult(taskId: string, expectedStatus: number) {
    const task = await iexecPoco.viewTask(taskId);
    expect(task.status).to.equal(expectedStatus);
    await expect(iexecPoco.resultFor(taskId)).to.be.revertedWith('task-pending');
}

async function createAppWithData(): Promise<string> {
    const iexec = IexecAccessors__factory.connect(proxyAddress, ethers.provider);
    const appRegistry: AppRegistry = AppRegistry__factory.connect(
        await iexec.appregistry(),
        appProvider,
    );
    const appReceipt = await appRegistry
        .createApp(
            appProvider.address,
            'my-app',
            'APP_TYPE_0',
            APP_MULTIADDR,
            APP_CHECKSUM,
            APP_MR_ENCLAVE,
        )
        .then((tx) => tx.wait());
    return await extractRegistryEntryAddress(appReceipt);
}

async function createDatasetWithData(): Promise<string> {
    const iexec = IexecAccessors__factory.connect(proxyAddress, ethers.provider);
    const datasetRegistry: DatasetRegistry = DatasetRegistry__factory.connect(
        await iexec.datasetregistry(),
        datasetProvider,
    );
    const datasetReceipt = await datasetRegistry
        .createDataset(datasetProvider.address, 'my-dataset', DATASET_MULTIADDR, DATASET_CHECKSUM)
        .then((tx) => tx.wait());
    return await extractRegistryEntryAddress(datasetReceipt);
}
