// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture, mine, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { OrdersAssets, OrdersPrices, buildOrders } from '../../../utils/createOrders';
import {
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
    getTaskId,
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
    let iexecPocoAsAnyone: IexecInterfaceNative;
    let iexecWrapper: IexecWrapper;
    let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
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
        iexecPocoAsAnyone = iexecPoco.connect(anyone);
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

    // TODO: Wrap tests inside `describe('Claim ' [...]`
    /**
     * Generic claim test (longest code path) where it should claim a revealing
     * task after deadline. The task comes from a deal payed by a sponsor.
     */
    it('Should claim task of deal payed by sponsor', async function () {
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
            await iexecWrapper.signAndSponsorMatchOrders(orders);
        const schedulerDealStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            expectedVolume,
        );
        const schedulerTaskStake = schedulerDealStake / expectedVolume;
        const kittyAddress = await iexecPoco.kitty_address();
        await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
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
        expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(0);
        expect(await iexecPoco.balanceOf(sponsor.address)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(dealPrice);
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

        const claimTx = await iexecPocoAsAnyone.claim(taskId);
        await claimTx.wait();
        await expect(claimTx)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(iexecPoco.address, sponsor.address, taskPrice)
            .to.emit(iexecPoco, 'Unlock')
            .withArgs(sponsor.address, taskPrice)
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
            await expect(claimTx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, worker.address, workerTaskStake)
                .to.emit(iexecPoco, 'Unlock')
                .withArgs(worker.address, workerTaskStake);
        }
        await expect(claimTx).to.emit(iexecPoco, 'TaskClaimed').withArgs(taskId);

        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.FAILED);
        const remainingTasksToClaim = expectedVolume - claimedTasks;
        expect(await iexecPoco.balanceOf(iexecPoco.address)).to.be.equal(
            taskPrice * remainingTasksToClaim + // sponsor has 2nd & 3rd task locked
                schedulerDealStake, // kitty value since 1st task seized
        );
        // 2nd & 3rd tasks can still be claimed.
        expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(0);
        expect(await iexecPoco.balanceOf(sponsor.address)).to.be.equal(taskPrice * claimedTasks);
        expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(
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
        await expect(iexecPocoAsAnyone.claim(taskId)).to.be.revertedWithoutReason();
    });

    it('Should claim task of deal payed by requester', async function () {
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
        });
        const { dealId, taskId, taskIndex, dealPrice, startTime } =
            await iexecWrapper.signAndMatchOrders(orders);
        await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
        expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(dealPrice);
        expect(await iexecPoco.balanceOf(sponsor.address)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(0);
        await time.setNextBlockTimestamp(startTime + maxDealDuration);

        await expect(iexecPocoAsAnyone.claim(taskId))
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(iexecPoco.address, requester.address, taskPrice)
            .to.emit(iexecPoco, 'Unlock')
            .withArgs(requester.address, taskPrice)
            .to.emit(iexecPoco, 'TaskClaimed');
        expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(dealPrice);
        expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(0);
        expect(await iexecPoco.balanceOf(sponsor.address)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(0);
    });

    it('Should claim active task after deadline', async function () {
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
        });
        const { dealId, taskId, taskIndex, startTime } =
            await iexecWrapper.signAndMatchOrders(orders);
        await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.ACTIVE);
        await time.setNextBlockTimestamp(startTime + maxDealDuration);

        await expect(iexecPocoAsAnyone.claim(taskId)).to.emit(iexecPoco, 'TaskClaimed');
    });

    it('Should not claim unset task', async function () {
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
        });
        const { taskId } = await iexecWrapper.signAndMatchOrders(orders);
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.UNSET);

        await expect(iexecPocoAsAnyone.claim(taskId)).to.be.revertedWithoutReason();
    });

    it('Should not claim completed task', async function () {
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            trust: 0,
        });
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(orders);
        await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
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

        await expect(iexecPocoAsAnyone.claim(taskId)).to.be.revertedWithoutReason();
    });

    it('Should not claim before deadline', async function () {
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
        });
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(orders);
        await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
        // No time traveling after deadline

        await expect(iexecPocoAsAnyone.claim(taskId)).to.be.revertedWithoutReason();
    });

    describe('Claim array', function () {
        it('Should claim array', async function () {
            const volume = 3;
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
            });
            const { dealId, startTime } = await iexecWrapper.signAndMatchOrders(orders);
            const taskIds = [];
            for (let taskIndex = 0; taskIndex < volume; taskIndex++) {
                taskIds.push(getTaskId(dealId, taskIndex));
                await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
            }
            await time.setNextBlockTimestamp(startTime + maxDealDuration);
            // Mine empty block so timestamp is accurate when static call is made
            await mine();

            expect(await iexecPocoAsAnyone.callStatic.claimArray(taskIds)).to.be.true;
            const claimArrayTx = await iexecPocoAsAnyone.claimArray(taskIds);
            await claimArrayTx.wait();
            for (let taskId of taskIds) {
                await expect(claimArrayTx).to.emit(iexecPoco, 'TaskClaimed').withArgs(taskId);
            }
        });

        it('Should not claim array when one is not claimable', async function () {
            const volume = 2;
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
            });
            const { dealId, startTime } = await iexecWrapper.signAndMatchOrders(orders);
            const taskIndex1 = 0;
            const taskIndex2 = 1;
            const taskId1 = getTaskId(dealId, taskIndex1);
            const taskId2 = getTaskId(dealId, taskIndex2);
            // Initialize only 1 task.
            await iexecPocoAsAnyone.initialize(dealId, taskIndex1).then((tx) => tx.wait());
            await time.setNextBlockTimestamp(startTime + maxDealDuration);

            // Check first task is claimable and second task is not claimable
            await expect(iexecPoco.estimateGas.claim(taskId1)).to.not.be.revertedWithoutReason();
            await expect(iexecPoco.estimateGas.claim(taskId2)).to.be.revertedWithoutReason();
            // Claim array will fail
            await expect(iexecPoco.claimArray([taskId1, taskId2])).to.be.revertedWithoutReason();
        });

        describe('Initialize and claim array', function () {
            it('Should initialize and claim array', async function () {
                const volume = 3;
                const { orders } = buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                });
                const { dealId, startTime } = await iexecWrapper.signAndMatchOrders(orders);
                const dealIds = [dealId, dealId, dealId];
                const taskIndexes = [0, 1, 2];
                await time.setNextBlockTimestamp(startTime + maxDealDuration).then(() => mine());

                expect(
                    await iexecPoco
                        .connect(anyone)
                        .callStatic.initializeAndClaimArray(dealIds, taskIndexes),
                ).to.be.true;
                const initializeAndClaimArrayTx = await iexecPoco
                    .connect(anyone)
                    .initializeAndClaimArray(dealIds, taskIndexes);
                await initializeAndClaimArrayTx.wait();
                for (const taskIndex of taskIndexes) {
                    const taskId = getTaskId(dealId, taskIndex);
                    await expect(initializeAndClaimArrayTx)
                        .to.emit(iexecPoco, 'TaskInitialize')
                        .withArgs(taskId, orders.workerpool.workerpool)
                        .to.emit(iexecPoco, 'TaskClaimed')
                        .withArgs(taskId);
                }
            });

            it('Should not initialize and claim array if incompatible length of inputs', async function () {
                const dealId = ethers.utils.hashMessage('dealId');
                await expect(
                    iexecPoco.initializeAndClaimArray([dealId, dealId], [0]),
                ).to.be.revertedWithoutReason();
            });

            it('Should not initialize and claim array if one specific fails', async function () {
                const volume = 2;
                const { orders } = buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                });
                const { dealId, startTime } = await iexecWrapper.signAndMatchOrders(orders);
                const taskIndex0 = 0;
                const taskIndex1 = 1;
                await iexecPoco // Make first task already initialized
                    .connect(scheduler)
                    .initialize(dealId, taskIndex0)
                    .then((tx) => tx.wait());
                await time.setNextBlockTimestamp(startTime + maxDealDuration);

                // Will fail since first task is already initialized
                await expect(
                    iexecPoco.initializeAndClaimArray([dealId, dealId], [taskIndex0, taskIndex1]),
                ).to.be.revertedWithoutReason();
            });
        });
    });
});
