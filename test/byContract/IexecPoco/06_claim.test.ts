// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import hre, { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { IexecPoco1__factory } from '../../../typechain/factories/contracts/modules/interfaces/IexecPoco1.v8.sol';
import {
    IexecOrders,
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    signOrders,
} from '../../../utils/createOrders';
import {
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getDealId,
    getIexecAccounts,
    getTaskId,
    setNextBlockTimestamp,
} from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';
import constants from './../../../utils/constants';

const categoryTime = 300;
const maxDealDuration = 10 * categoryTime;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const taskPrice = appPrice + datasetPrice + workerpoolPrice;
const enclaveAddress = ethers.constants.AddressZero;

describe('Poco', async () => {
    let proxyAddress: string;
    let iexecPoco: IexecInterfaceNative;
    let iexecWrapper: IexecWrapper;
    let appAddress = '';
    let workerpoolAddress = '';
    let datasetAddress = '';
    let [
        iexecAdmin,
        requester,
        sponsor,
        appProvider,
        datasetProvider,
        scheduler,
        worker1,
        worker2,
        anyone,
    ]: SignerWithAddress[] = [];
    let ordersActors: OrdersActors;
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;

    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({
            iexecAdmin,
            requester,
            sponsor,
            appProvider,
            datasetProvider,
            scheduler,
            worker1,
            worker2,
            anyone,
        } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        await iexecWrapper.setTeeBroker('0x0000000000000000000000000000000000000000');
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, iexecAdmin);
        ordersActors = {
            appOwner: appProvider,
            datasetOwner: datasetProvider,
            workerpoolOwner: scheduler,
            requester: requester,
        };
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

    /**
     * Generic claim test (longest code path) where it should claim a revealing
     * task after deadline.
     */
    it('Should claim', async function () {
        const expectedVolume = 3; // > 1 to explicit taskPrice vs dealPrice
        const claimedTasks = 1;
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            volume: expectedVolume,
            trust: 4, // Consensus is reachable with 2 fresh workers
        });
        const { dealId, taskId, taskIndex, dealPrice, startTime } =
            await signAndMatchOrders(orders);
        const schedulerDealStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            expectedVolume,
        );
        const schedulerTaskStake = schedulerDealStake / expectedVolume;
        const kittyAddress = await iexecPoco.kitty_address();
        await iexecPoco
            .connect(scheduler)
            .initialize(dealId, taskIndex)
            .then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        const workers = [worker1, worker2];
        for (const worker of workers) {
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker,
            );
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                enclaveAddress,
                scheduler,
            );
            await iexecWrapper.depositInIexecAccount(worker, workerTaskStake);
            await iexecPoco
                .connect(worker)
                .contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    ethers.constants.AddressZero,
                    '0x',
                    schedulerSignature,
                )
                .then((tx) => tx.wait());
        }
        expect(await iexecPoco.balanceOf(iexecPoco.address)).to.be.equal(
            dealPrice + schedulerDealStake + workerTaskStake * workers.length,
        );
        expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(dealPrice);
        expect(await iexecPoco.balanceOf(scheduler.address)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(scheduler.address)).to.be.equal(schedulerDealStake);
        for (const worker of workers) {
            expect(await iexecPoco.balanceOf(worker.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(worker.address)).to.be.equal(workerTaskStake);
        }
        expect(await iexecPoco.balanceOf(kittyAddress)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(kittyAddress)).to.be.equal(0);
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.REVEALING);
        await time.setNextBlockTimestamp(startTime + maxDealDuration);

        const claimReceipt = await iexecPoco
            .connect(anyone)
            .claim(taskId)
            .then((tx) => tx.wait());
        expect(claimReceipt)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(iexecPoco.address, requester.address, taskPrice)
            .to.emit(iexecPoco, 'Unlock')
            .withArgs(requester.address, taskPrice)
            .to.emit(iexecPoco, 'Seize')
            .withArgs(scheduler.address, schedulerTaskStake, taskId)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(iexecPoco.address, kittyAddress, schedulerTaskStake)
            .to.emit(iexecPoco, 'Reward')
            .withArgs(kittyAddress, schedulerTaskStake, taskId)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(kittyAddress, iexecPoco.address, schedulerTaskStake)
            .to.emit(iexecPoco, 'Lock')
            .withArgs(kittyAddress, schedulerTaskStake);
        for (const worker of workers) {
            expect(claimReceipt)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, worker.address, workerTaskStake)
                .to.emit(iexecPoco, 'Unlock')
                .withArgs(worker.address, workerTaskStake);
        }
        expect(claimReceipt).to.emit(iexecPoco, 'TaskClaimed').withArgs(taskId);

        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.FAILED);
        const remainingTasksToClaim = expectedVolume - claimedTasks;
        expect(await iexecPoco.balanceOf(iexecPoco.address)).to.be.equal(
            taskPrice * remainingTasksToClaim + // requester has 2nd & 3rd task locked
                schedulerDealStake, // kitty value since 1st task seized
        );
        // 2nd & 3rd tasks can still be claimed.
        expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(taskPrice * claimedTasks);
        expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(
            taskPrice * remainingTasksToClaim,
        );
        expect(await iexecPoco.balanceOf(scheduler.address)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(scheduler.address)).to.be.equal(
            schedulerTaskStake * remainingTasksToClaim,
        );
        for (const worker of workers) {
            expect(await iexecPoco.balanceOf(worker.address)).to.be.equal(workerTaskStake);
            expect(await iexecPoco.frozenOf(worker.address)).to.be.equal(0);
        }
        expect(await iexecPoco.balanceOf(kittyAddress)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(kittyAddress)).to.be.equal(
            schedulerTaskStake * claimedTasks,
        );
        // And should not claim twice
        await expect(iexecPoco.connect(anyone).claim(taskId)).to.be.reverted;
    });

    it('Should claim active task after deadline', async function () {
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
        });
        const { dealId, taskId, taskIndex, startTime } = await signAndMatchOrders(orders);
        await iexecPoco
            .connect(scheduler)
            .initialize(dealId, taskIndex)
            .then((tx) => tx.wait());
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.ACTIVE);
        await time.setNextBlockTimestamp(startTime + maxDealDuration);

        await expect(iexecPoco.connect(anyone).claim(taskId)).to.emit(iexecPoco, 'TaskClaimed');
    });

    it('Should not claim unset task', async function () {
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
        });
        const { taskId } = await signAndMatchOrders(orders);
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.UNSET);

        await expect(iexecPoco.connect(anyone).claim(taskId)).to.be.reverted;
    });

    it('Should not claim completed task', async function () {
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            trust: 0,
        });
        const { dealId, taskId, taskIndex } = await signAndMatchOrders(orders);
        await iexecPoco
            .connect(scheduler)
            .initialize(dealId, taskIndex)
            .then((tx) => tx.wait());
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker1.address,
            taskId,
            enclaveAddress,
            scheduler,
        );
        const workerTaskStake = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
        await iexecPoco
            .connect(worker1)
            .contributeAndFinalize(
                taskId,
                resultDigest,
                results,
                '0x',
                enclaveAddress,
                constants.NULL.SIGNATURE,
                schedulerSignature,
            )
            .then((tx) => tx.wait());
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);

        await expect(iexecPoco.connect(anyone).claim(taskId)).to.be.reverted;
    });

    it('Should not claim before deadline', async function () {
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
        });
        const { taskId } = await signAndMatchOrders(orders);
        // No time traveling after deadline

        await expect(iexecPoco.connect(anyone).claim(taskId)).to.be.reverted;
    });

    /**
     * @notice Before properly matching orders, this method takes care of
     * signing orders and depositing required stakes.
     */
    async function signAndMatchOrders(orders: IexecOrders) {
        const domain = {
            name: 'iExecODB',
            version: '5.0.0',
            chainId: hre.network.config.chainId,
            verifyingContract: proxyAddress,
        };
        await signOrders(domain, orders, ordersActors);
        const requestOrder = orders.requester;
        const taskIndex = 0;
        const dealId = getDealId(domain, requestOrder, taskIndex);
        const taskId = getTaskId(dealId, taskIndex);
        const volume = Number(requestOrder.volume);
        const dealPrice = taskPrice * volume;
        const dealPayer = requester;
        await iexecWrapper.depositInIexecAccount(dealPayer, dealPrice);
        await iexecWrapper
            .computeSchedulerDealStake(workerpoolPrice, volume)
            .then((stake) => iexecWrapper.depositInIexecAccount(scheduler, stake));
        const startTime = await setNextBlockTimestamp();
        await IexecPoco1__factory.connect(proxyAddress, dealPayer)
            .matchOrders(orders.app, orders.dataset, orders.workerpool, requestOrder)
            .then((tx) => tx.wait());
        return { dealId, taskId, taskIndex, dealPrice, startTime };
    }
});