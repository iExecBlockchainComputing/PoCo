// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { loadFixture, setStorageAt, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    TestClient__factory,
} from '../../../typechain';
import { OrdersAssets, OrdersPrices, buildOrders } from '../../../utils/createOrders';
import {
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildResultCallbackAndDigest,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
} from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const hexResults = ethers.utils.hexlify(results);
const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);

const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const taskPrice = appPrice + datasetPrice + workerpoolPrice;
const emptyEnclaveAddress = AddressZero;
const emptyEnclaveSignature = '0x';

describe('IexecPoco2#finalize', async () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsScheduler]: IexecInterfaceNative[] = [];
    let iexecWrapper: IexecWrapper;
    let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
    let [
        requester,
        sponsor,
        appProvider,
        datasetProvider,
        scheduler,
        worker1,
        worker2,
        worker3,
        worker4,
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
            requester,
            sponsor,
            appProvider,
            datasetProvider,
            scheduler,
            worker1,
            worker2,
            worker3,
            worker4,
            anyone,
        } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        await iexecWrapper.setTeeBroker('0x0000000000000000000000000000000000000000');
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsScheduler = iexecPoco.connect(scheduler);
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

    //TODO: Remove describe wrapper
    describe('Finalize', async () => {
        it('Should finalize task of deal payed by sponsor (with callback)', async () => {
            const oracleConsumerInstance = await new TestClient__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.deployed());
            const expectedVolume = 3; // > 1 to explicit taskPrice vs dealPrice
            const remainingTasksToFinalize = expectedVolume - 1;
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume: expectedVolume,
                trust: 3,
                callback: oracleConsumerInstance.address,
            });
            const { dealId, taskId, taskIndex, dealPrice } =
                await iexecWrapper.signAndSponsorMatchOrders(orders);
            const schedulerDealStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                expectedVolume,
            );
            const schedulerTaskStake = schedulerDealStake / expectedVolume;
            const kittyAddress = await iexecPoco.kitty_address();
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const workerTaskStake = await iexecPoco
                .viewDeal(dealId)
                .then((deal) => deal.workerStake.toNumber());
            const { callbackResultDigest: wrongCallbackResultDigest } =
                buildResultCallbackAndDigest(567);
            const workers = [
                { wallet: worker1, callbackResultDigest: callbackResultDigest },
                { wallet: worker2, callbackResultDigest: wrongCallbackResultDigest },
                { wallet: worker3, callbackResultDigest: callbackResultDigest },
                { wallet: worker4, callbackResultDigest: callbackResultDigest },
            ];
            const winningWorkers = [worker1, worker3, worker4];
            const losingWorker = worker2;
            // Set same non-zero score to each worker.
            // Each winning worker should win 1 workerScore point.
            // Losing worker should loose at least 33% of its workerScore (here
            // it will loose 1 point since score is an integer).
            for (const worker of workers) {
                await setWorkerScoreInStorage(worker.wallet.address, 1);
            }
            for (const worker of workers) {
                const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                    taskId,
                    worker.callbackResultDigest,
                    worker.wallet,
                );
                const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                    worker.wallet.address,
                    taskId,
                    emptyEnclaveAddress,
                    scheduler,
                );
                await iexecWrapper.depositInIexecAccount(worker.wallet, workerTaskStake);
                await iexecPoco
                    .connect(worker.wallet)
                    .contribute(
                        taskId,
                        resultHash,
                        resultSeal,
                        emptyEnclaveAddress,
                        emptyEnclaveSignature,
                        schedulerSignature,
                    )
                    .then((tx) => tx.wait());
            }
            for (const worker of winningWorkers) {
                await iexecPoco
                    .connect(worker)
                    .reveal(taskId, callbackResultDigest)
                    .then((tx) => tx.wait());
            }
            expect(await iexecPoco.balanceOf(iexecPoco.address)).to.be.equal(
                dealPrice + schedulerDealStake + workers.length * workerTaskStake,
            );
            expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.balanceOf(sponsor.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(dealPrice);
            expect(await iexecPoco.balanceOf(appProvider.address)).to.be.equal(0);
            expect(await iexecPoco.balanceOf(datasetProvider.address)).to.be.equal(0);
            expect(await iexecPoco.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(scheduler.address)).to.be.equal(schedulerDealStake);
            for (const worker of [...winningWorkers, losingWorker]) {
                expect(await iexecPoco.balanceOf(worker.address)).to.be.equal(0);
                expect(await iexecPoco.frozenOf(worker.address)).to.be.equal(workerTaskStake);
                expect(await iexecPoco.viewScore(worker.address)).to.be.equal(1);
            }
            expect(await iexecPoco.balanceOf(kittyAddress)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(kittyAddress)).to.be.equal(0);
            const taskBefore = await iexecPoco.viewTask(taskId);
            expect(taskBefore.status).to.equal(TaskStatusEnum.REVEALING);
            expect(taskBefore.revealCounter).to.equal(taskBefore.winnerCounter);

            const finalizeTx = await iexecPocoAsScheduler.finalize(
                taskId,
                results,
                resultsCallback,
            );
            await finalizeTx.wait();
            await expect(finalizeTx)
                .to.emit(iexecPoco, 'Seize')
                .withArgs(sponsor.address, taskPrice, taskId)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, appProvider.address, appPrice)
                .to.emit(iexecPoco, 'Reward')
                .withArgs(appProvider.address, appPrice, taskId)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, datasetProvider.address, datasetPrice)
                .to.emit(iexecPoco, 'Reward')
                .withArgs(datasetProvider.address, datasetPrice, taskId)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, scheduler.address, schedulerTaskStake)
                .to.emit(iexecPoco, 'Unlock')
                .withArgs(scheduler.address, schedulerTaskStake);
            const workerReward = 429000000;
            for (const worker of winningWorkers) {
                await expect(finalizeTx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(iexecPoco.address, worker.address, workerTaskStake)
                    .to.emit(iexecPoco, 'Unlock')
                    .withArgs(worker.address, workerTaskStake)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(iexecPoco.address, worker.address, workerReward)
                    .to.emit(iexecPoco, 'Reward')
                    .withArgs(worker.address, workerReward, taskId)
                    .to.emit(iexecPoco, 'AccurateContribution')
                    .withArgs(worker.address, taskId);
            }
            await expect(finalizeTx)
                .to.emit(iexecPoco, 'Seize')
                .withArgs(losingWorker.address, workerTaskStake, taskId)
                .to.emit(iexecPoco, 'FaultyContribution')
                .withArgs(losingWorker.address, taskId);
            const schedulerReward =
                workerpoolPrice -
                winningWorkers.length * workerReward + // winning workers rewards
                workerTaskStake; // losing worker stake
            await expect(finalizeTx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, scheduler.address, schedulerReward)
                .to.emit(iexecPoco, 'Reward')
                .withArgs(scheduler.address, schedulerReward, taskId)
                .to.emit(iexecPoco, 'TaskFinalize')
                .withArgs(taskId, hexResults)
                .to.emit(oracleConsumerInstance, 'GotResult')
                .withArgs(taskId, resultsCallback);
            const task = await iexecPoco.viewTask(taskId);
            expect(task.status).equal(TaskStatusEnum.COMPLETED);
            expect(task.results).equal(hexResults);
            expect(task.resultsCallback).equal(resultsCallback);
            expect(await iexecPoco.balanceOf(iexecPoco.address)).to.be.equal(
                remainingTasksToFinalize * (taskPrice + schedulerTaskStake),
            );
            expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.balanceOf(sponsor.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(
                remainingTasksToFinalize * taskPrice,
            );
            expect(await iexecPoco.balanceOf(appProvider.address)).to.be.equal(appPrice);
            expect(await iexecPoco.balanceOf(datasetProvider.address)).to.be.equal(datasetPrice);
            expect(await iexecPoco.balanceOf(scheduler.address)).to.be.equal(
                schedulerTaskStake + // unlocked stake from first task
                    schedulerReward, // reward from first task
            );
            expect(await iexecPoco.frozenOf(scheduler.address)).to.be.equal(
                remainingTasksToFinalize * schedulerTaskStake,
            );
            for (const worker of winningWorkers) {
                expect(await iexecPoco.balanceOf(worker.address)).to.be.equal(
                    workerTaskStake + workerReward,
                );
                expect(await iexecPoco.frozenOf(worker.address)).to.be.equal(0);
                expect(await iexecPoco.viewScore(worker.address)).to.be.equal(2);
            }
            expect(await iexecPoco.balanceOf(losingWorker.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(losingWorker.address)).to.be.equal(0);
            expect(await iexecPoco.viewScore(losingWorker.address)).to.be.equal(0);
            // TODO: Update test with non-empty kitty
            expect(await iexecPoco.balanceOf(kittyAddress)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(kittyAddress)).to.be.equal(0);
        });

        it('Should finalize task of deal payed by requester (no callback, no dataset)', async () => {
            const { orders } = buildOrders({
                assets: {
                    app: appAddress,
                    dataset: AddressZero,
                    workerpool: workerpoolAddress,
                },
                requester: requester.address,
                prices: ordersPrices,
            });
            const taskPrice = appPrice + workerpoolPrice;
            const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(orders);
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const workerTaskStake = await iexecPoco
                .viewDeal(dealId)
                .then((deal) => deal.workerStake.toNumber());
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker1,
            );
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker1.address,
                taskId,
                emptyEnclaveAddress,
                scheduler,
            );
            await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
            await iexecPoco
                .connect(worker1)
                .contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    schedulerSignature,
                )
                .then((tx) => tx.wait());
            await iexecPoco
                .connect(worker1)
                .reveal(taskId, resultDigest)
                .then((tx) => tx.wait());
            const requesterFrozenBefore = (await iexecPoco.frozenOf(requester.address)).toNumber();
            const sponsorFrozenBefore = await iexecPoco.frozenOf(sponsor.address);

            await expect(
                iexecPocoAsScheduler.finalize(taskId, results, '0x'),
            ).to.changeTokenBalances(
                iexecPoco,
                [requester, sponsor, appProvider, datasetProvider],
                [
                    0, // requester balance is unchanged, only frozen is changed
                    0,
                    appPrice, // app provider is rewarded
                    0, // but dataset provider is not rewarded
                ],
            );
            expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(
                requesterFrozenBefore - taskPrice,
            );
            expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(sponsorFrozenBefore);
            const task = await iexecPoco.viewTask(taskId);
            expect(task.resultsCallback).to.equal('0x'); // deal without callback
        });
    });

    it('Should finalize task after reveal deadline with at least one reveal', async () => {
        const volume = 1;
        const { orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            volume,
            trust: 3,
        });
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(orders);
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
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
                emptyEnclaveAddress,
                scheduler,
            );
            await iexecWrapper.depositInIexecAccount(worker, workerTaskStake);
            await iexecPoco
                .connect(worker)
                .contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    schedulerSignature,
                )
                .then((tx) => tx.wait());
        }
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, resultDigest)
            .then((tx) => tx.wait());
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        expect(task.revealCounter).to.equal(1);
        await time.setNextBlockTimestamp(task.revealDeadline);
        // worker2 did not reveal
        // so task can be finalized after revealDeadline
        await expect(iexecPocoAsScheduler.finalize(taskId, results, '0x')).to.emit(
            iexecPoco,
            'TaskFinalize',
        );
    });

    it('Should not finalize when caller is not scheduler', async () => {
        const { dealId, taskId } = await iexecWrapper.signAndMatchOrders(
            buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            }).orders,
        );
        const deal = await iexecPoco.viewDeal(dealId);
        expect(deal.workerpool.owner).to.equal(scheduler.address).not.equal(anyone.address);
        // caller is not scheduler
        await expect(
            iexecPoco.connect(anyone).finalize(taskId, results, '0x'),
        ).to.be.revertedWithoutReason(); // onlyScheduler modifier
    });

    it('Should not finalize task when task status is not revealing', async () => {
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            }).orders,
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.ACTIVE);
        // caller is scheduler
        // but task status is not revealing
        await expect(
            iexecPocoAsScheduler.finalize(taskId, results, '0x'),
        ).to.be.revertedWithoutReason(); // require#1
    });

    it('Should not finalize task after final deadline', async () => {
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            }).orders,
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            resultDigest,
            worker1,
        );
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker1.address,
            taskId,
            emptyEnclaveAddress,
            scheduler,
        );
        await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
        await iexecPoco
            .connect(worker1)
            .contribute(
                taskId,
                resultHash,
                resultSeal,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                schedulerSignature,
            )
            .then((tx) => tx.wait());
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        await time.setNextBlockTimestamp(task.finalDeadline);
        // caller is scheduler, task status is revealing
        // but after final deadline
        await expect(
            iexecPocoAsScheduler.finalize(taskId, results, '0x'),
        ).to.be.revertedWithoutReason(); // require#2
    });

    it('Should not finalize when winner counter is not reached nor at least one worker revealed', async () => {
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                trust: 3,
            }).orders,
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
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
                emptyEnclaveAddress,
                scheduler,
            );
            await iexecWrapper.depositInIexecAccount(worker, workerTaskStake);
            await iexecPoco
                .connect(worker)
                .contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    schedulerSignature,
                )
                .then((tx) => tx.wait());
        }
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        expect(task.winnerCounter).to.equal(2).not.equal(task.revealCounter);
        await time.setNextBlockTimestamp(task.revealDeadline);
        // caller is scheduler, task status is revealing, before final deadline
        // winner counter is not reached and reveal deadline is reached but not
        // even one worker revealed
        await expect(
            iexecPocoAsScheduler.finalize(taskId, results, '0x'),
        ).to.be.revertedWithoutReason(); // require#3
    });

    it('Should not finalize task when resultsCallback is not expected', async () => {
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            }).orders,
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            resultDigest,
            worker1,
        );
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker1.address,
            taskId,
            emptyEnclaveAddress,
            scheduler,
        );
        await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
        await iexecPoco
            .connect(worker1)
            .contribute(
                taskId,
                resultHash,
                resultSeal,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                schedulerSignature,
            )
            .then((tx) => tx.wait());
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, resultDigest)
            .then((tx) => tx.wait());
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        expect(task.revealCounter).to.equal(1);
        // caller is scheduler, task status is revealing, before final deadline,
        // reveal counter is reached
        // but resultsCallback is not expected
        await expect(
            iexecPocoAsScheduler.finalize(taskId, results, '0x01'),
        ).to.be.revertedWithoutReason(); // require#4
    });

    async function setWorkerScoreInStorage(worker: string, score: number) {
        const workerScoreSlot = ethers.utils.hexStripZeros(
            ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ['address', 'uint256'],
                    [
                        worker,
                        23, // Slot index of m_workerScores in Store
                    ],
                ),
            ),
        );
        await setStorageAt(proxyAddress, workerScoreSlot, score);
    }
});
