// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../typechain';
import { OrdersActors, OrdersAssets, OrdersPrices, buildOrders } from '../utils/createOrders';
import {
    PocoMode,
    TaskStatusEnum,
    buildResultCallbackAndDigest,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
} from '../utils/poco-tools';
import { IexecWrapper } from './utils/IexecWrapper';

//  +---------+-------------+-------------+-------------+----------+-----+---------------------------------------------+
//  |         | Sponsorship | Replication | Beneficiary | Callback | BoT |              Type                           |
//  +---------+-------------+-------------+-------------+----------+-----+---------------------------------------------+
//  |   [1]   |     ✔       |     ✔       |     ✔       |    ✔     |  ✔  |                  Standard                   |
//  |   [2]   |     x       |     ✔       |     ✔       |    ✔     |  ✔  |                  Standard                   |
//  |   [3]   |     ✔       |     x       |     ✔       |    ✔     |  ✔  |                  Standard,TEE               |
//  |   [4]   |     x       |     x       |     ✔       |    ✔     |  ✔  |                  Standard,TEE               |
//  |   [5]   |     x       |     x       |     x       |    x     |  x  |                  Standard,TEE               |
//  |   [6.x] |     x       |     ✔       |     x       |    x     |  x  |             Standard, X good workers        |
//  |   [7]   |     x       |     ✔       |     x       |    x     |  x  |     Standard, 4 good workers 1 bad worker   |
//  +---------+-------------+-------------+-------------+----------+-----+---------------------------------------------+

const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const callbackAddress = ethers.Wallet.createRandom().address;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);

let proxyAddress: string;
let iexecPoco: IexecInterfaceNative;
let iexecWrapper: IexecWrapper;
let [appAddress, workerpoolAddress, datasetAddress]: string[] = [];
let [
    requester,
    sponsor,
    beneficiary,
    appProvider,
    datasetProvider,
    scheduler,
    anyone,
    worker1,
    worker2,
    worker3,
    worker4,
    worker5,
]: SignerWithAddress[] = [];
let ordersActors: OrdersActors;
let ordersAssets: OrdersAssets;
let ordersPrices: OrdersPrices;

describe('Integration tests', function () {
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
            beneficiary,
            appProvider,
            datasetProvider,
            scheduler,
            anyone,
            worker1,
            worker2,
            worker3,
            worker4,
            worker5,
        } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
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

    it('[1] Sponsorship, beneficiary, callback, BoT, replication', async function () {
        const volume = 3;
        // Create deal.
        const workers = [worker1, worker2];
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: standardDealTag,
            beneficiary: beneficiary.address,
            callback: callbackAddress,
            volume,
            trust: workers.length ** 2 - 1,
        });
        const { dealId, dealPrice, schedulerStakePerDeal } =
            await iexecWrapper.signAndSponsorMatchOrders(...orders.toArray());
        const taskPrice = appPrice + datasetPrice + workerpoolPrice;
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        const workersRewardPerTask = await iexecWrapper.computeWorkersRewardPerTask(
            dealId,
            PocoMode.CLASSIC,
        );
        const schedulerRewardPerTask = workerpoolPrice - workersRewardPerTask;
        // Save frozens

        const accounts = [sponsor, requester, scheduler, appProvider, datasetProvider, ...workers];
        const accountsInitialFrozens = await getInitialFrozens(accounts);
        const workerStakePerTask = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        // Finalize each task and check balance changes.
        for (let taskIndex = 0; taskIndex < volume; taskIndex++) {
            const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
            for (const worker of workers) {
                await iexecWrapper.contributeToTask(
                    dealId,
                    taskIndex,
                    callbackResultDigest,
                    worker,
                );
            }
            // Reveal contributions for all workers
            for (const worker of workers) {
                await iexecPoco
                    .connect(worker)
                    .reveal(taskId, callbackResultDigest)
                    .then((tx) => tx.wait());
            }
            const finalizeTx = await iexecPoco
                .connect(scheduler)
                .finalize(taskId, results, resultsCallback);
            await finalizeTx.wait();
            expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);
            // Verify token balance changes
            const expectedProxyBalanceChange = -(
                taskPrice +
                schedulerStakePerTask +
                workerStakePerTask * workers.length
            );
            const expectedWorkerBalanceChange =
                workerStakePerTask + workersRewardPerTask / workers.length;
            await expect(finalizeTx).to.changeTokenBalances(
                iexecPoco,
                [proxyAddress, ...accounts],
                [
                    expectedProxyBalanceChange, // Proxy
                    0, // Sponsor
                    0, // Requester
                    schedulerStakePerTask + schedulerRewardPerTask, // Scheduler
                    appPrice, // AppProvider
                    datasetPrice, // DatasetProvider
                    ...workers.map(() => expectedWorkerBalanceChange), // Workers
                ],
            );
            // Multiply amount by the number of finalized tasks to correctly compute
            // stake and reward amounts.
            const completedTasks = taskIndex + 1;
            // Calculate expected frozen changes
            const expectedFrozenChanges = [
                0, // Proxy
                -taskPrice * completedTasks, // Sponsor
                0, // Requester
                -schedulerStakePerTask * completedTasks, // Scheduler
                0, // AppProvider
                0, // DatasetProvider,
                ...workers.map(() => 0), // Add 0 for each worker
            ];
            await checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
        }
    });

    it('[2] No sponsorship, beneficiary, callback, BoT, replication', async function () {
        const volume = 3;
        // Create deal.
        const workers = [worker1, worker2];
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: standardDealTag,
            beneficiary: beneficiary.address,
            callback: callbackAddress,
            volume,
            trust: workers.length ** 2 - 1,
        });
        const { dealId, dealPrice, schedulerStakePerDeal } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        const taskPrice = appPrice + datasetPrice + workerpoolPrice;
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        const workersRewardPerTask = await iexecWrapper.computeWorkersRewardPerTask(
            dealId,
            PocoMode.CLASSIC,
        );
        const schedulerRewardPerTask = workerpoolPrice - workersRewardPerTask;
        // Save frozens

        const accounts = [requester, scheduler, appProvider, datasetProvider, ...workers];
        const accountsInitialFrozens = await getInitialFrozens(accounts);
        // Finalize each task and check balance changes.
        const workerStake = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        for (let taskIndex = 0; taskIndex < volume; taskIndex++) {
            const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
            for (const worker of workers) {
                await iexecWrapper.contributeToTask(
                    dealId,
                    taskIndex,
                    callbackResultDigest,
                    worker,
                );
            }
            // Reveal contributions for all workers
            for (const worker of workers) {
                await iexecPoco
                    .connect(worker)
                    .reveal(taskId, callbackResultDigest)
                    .then((tx) => tx.wait());
            }
            const finalizeTx = await iexecPoco
                .connect(scheduler)
                .finalize(taskId, results, resultsCallback);
            await finalizeTx.wait();
            expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);
            // Verify token balance changes
            const expectedProxyBalanceChange = -(
                taskPrice +
                schedulerStakePerTask +
                workerStake * workers.length
            );
            const expectedWorkerBalanceChange = workerStake + workersRewardPerTask / workers.length;
            await expect(finalizeTx).to.changeTokenBalances(
                iexecPoco,
                [proxyAddress, ...accounts],
                [
                    expectedProxyBalanceChange, // Proxy
                    0, // Requester
                    schedulerStakePerTask + schedulerRewardPerTask, // Scheduler
                    appPrice, // AppProvider
                    datasetPrice, // DatasetProvider
                    ...workers.map(() => expectedWorkerBalanceChange), // Workers
                ],
            );
            // Multiply amount by the number of finalized tasks to correctly compute
            // stake and reward amounts.
            const completedTasks = taskIndex + 1;
            // Calculate expected frozen changes
            const expectedFrozenChanges = [
                0, // Proxy
                -taskPrice * completedTasks, // Requester
                -schedulerStakePerTask * completedTasks, // Scheduler
                0, // AppProvider
                0, // DatasetProvider
                ...workers.map(() => 0), // Add 0 for each worker
            ];
            await checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
        }
    });

    it('[3] Sponsorship, beneficiary, callback, BoT, no replication', async function () {
        const volume = 3;
        // Create deal.
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: teeDealTag,
            beneficiary: beneficiary.address,
            callback: callbackAddress,
            volume,
            trust: 1,
        });
        const { dealId, dealPrice, schedulerStakePerDeal } =
            await iexecWrapper.signAndSponsorMatchOrders(...orders.toArray());
        const taskPrice = appPrice + datasetPrice + workerpoolPrice;
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        const workersRewardPerTask = await iexecWrapper.computeWorkersRewardPerTask(
            dealId,
            PocoMode.CLASSIC,
        );
        const schedulerRewardPerTask = workerpoolPrice - workersRewardPerTask;
        // Save frozens
        const accounts = [sponsor, requester, scheduler, appProvider, datasetProvider, worker1];
        const accountsInitialFrozens = await getInitialFrozens(accounts);
        // Finalize each task and check balance changes.
        for (let taskIndex = 0; taskIndex < volume; taskIndex++) {
            const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
            const { workerStakePerTask } = await iexecWrapper.contributeToTeeTask(
                dealId,
                taskIndex,
                callbackResultDigest,
                worker1,
            );
            await iexecPoco
                .connect(worker1)
                .reveal(taskId, callbackResultDigest)
                .then((tx) => tx.wait());
            const finalizeTx = await iexecPoco
                .connect(scheduler)
                .finalize(taskId, results, resultsCallback);
            await finalizeTx.wait();
            expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);
            // Verify token balance changes
            const expectedProxyBalanceChange = -(
                taskPrice +
                schedulerStakePerTask +
                workerStakePerTask
            );
            await expect(finalizeTx).to.changeTokenBalances(
                iexecPoco,
                [proxyAddress, sponsor, scheduler, appProvider, datasetProvider, worker1],
                [
                    expectedProxyBalanceChange, // Proxy
                    0, // Sponsor
                    schedulerStakePerTask + schedulerRewardPerTask, // Scheduler
                    appPrice, // AppProvider
                    datasetPrice, // DatasetProvider
                    workerStakePerTask + workersRewardPerTask, // Worker
                ],
            );
            // Multiply amount by the number of finalized tasks to correctly compute
            // stake and reward amounts.
            const completedTasks = taskIndex + 1;
            // Calculate expected frozen changes
            const expectedFrozenChanges = [
                0, // Proxy
                -taskPrice * completedTasks, // Sponsor
                0, // Requester
                -schedulerStakePerTask * completedTasks, // Scheduler
                0, // AppProvider
                0, // DatasetProvider
                0, // Worker
            ];
            await checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
        }
    });

    it('[4] No sponsorship, beneficiary, callback, BoT, no replication', async function () {
        const volume = 3;
        // Create deal.
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: teeDealTag,
            beneficiary: beneficiary.address,
            callback: callbackAddress,
            volume,
            trust: 1,
        });
        const { dealId, dealPrice, schedulerStakePerDeal } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        const taskPrice = appPrice + datasetPrice + workerpoolPrice;
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        const workersRewardPerTask = await iexecWrapper.computeWorkersRewardPerTask(
            dealId,
            PocoMode.CLASSIC,
        );
        const schedulerRewardPerTask = workerpoolPrice - workersRewardPerTask;
        // Save frozens
        const accounts = [requester, scheduler, appProvider, datasetProvider, worker1];
        const accountsInitialFrozens = await getInitialFrozens(accounts);
        // Finalize each task and check balance changes.
        for (let taskIndex = 0; taskIndex < volume; taskIndex++) {
            const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
            const { workerStakePerTask } = await iexecWrapper.contributeToTeeTask(
                dealId,
                taskIndex,
                callbackResultDigest,
                worker1,
            );
            await iexecPoco
                .connect(worker1)
                .reveal(taskId, callbackResultDigest)
                .then((tx) => tx.wait());
            const finalizeTx = await iexecPoco
                .connect(scheduler)
                .finalize(taskId, results, resultsCallback);
            await finalizeTx.wait();
            expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);

            // Verify token balance changes
            const expectedProxyBalanceChange = -(
                taskPrice +
                schedulerStakePerTask +
                workerStakePerTask
            );
            await expect(finalizeTx).to.changeTokenBalances(
                iexecPoco,
                [proxyAddress, requester, scheduler, appProvider, datasetProvider, worker1],
                [
                    expectedProxyBalanceChange, // Proxy
                    0, // Requester
                    schedulerStakePerTask + schedulerRewardPerTask, // Scheduler
                    appPrice, // AppProvider
                    datasetPrice, // DatasetProvider
                    workerStakePerTask + workersRewardPerTask, // Worker
                ],
            );
            // Multiply amount by the number of finalized tasks to correctly compute
            // stake and reward amounts.
            const completedTasks = taskIndex + 1;
            // Calculate expected frozen changes
            const expectedFrozenChanges = [
                0, // Proxy
                -taskPrice * completedTasks, // Requester
                -schedulerStakePerTask * completedTasks, // Scheduler
                0, // AppProvider
                0, // DatasetProvider
                0, // Worker
            ];
            await checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
        }
    });

    it('[5] No sponsorship, no beneficiary, no callback, no BoT, no replication', async function () {
        const volume = 1;
        // Create deal.
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: teeDealTag,
            volume,
            trust: 1,
        });
        const { dealId, dealPrice, schedulerStakePerDeal } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        const workersRewardPerTask = await iexecWrapper.computeWorkersRewardPerTask(
            dealId,
            PocoMode.CLASSIC,
        );
        const schedulerRewardPerTask = workerpoolPrice - workersRewardPerTask;
        // Save frozens
        const accounts = [requester, scheduler, appProvider, datasetProvider, worker1];
        const accountsInitialFrozens = await getInitialFrozens(accounts);
        const taskIndex = 0;
        const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
        const { workerStakePerTask } = await iexecWrapper.contributeToTeeTask(
            dealId,
            taskIndex,
            resultDigest,
            worker1,
        );
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, resultDigest)
            .then((tx) => tx.wait());
        const finalizeTx = await iexecPoco.connect(scheduler).finalize(taskId, results, '0x');
        await finalizeTx.wait();
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);
        // Verify token balance changes
        const expectedProxyBalanceChange = -(
            dealPrice +
            schedulerStakePerTask +
            workerStakePerTask
        );
        await expect(finalizeTx).to.changeTokenBalances(
            iexecPoco,
            [proxyAddress, requester, scheduler, appProvider, datasetProvider, worker1],
            [
                expectedProxyBalanceChange, // Proxy
                0, // Requester
                schedulerStakePerTask + schedulerRewardPerTask, // Scheduler
                appPrice, // AppProvider
                datasetPrice, // DatasetProvider
                workerStakePerTask + workersRewardPerTask, // Worker
            ],
        );
        // Calculate expected frozen changes
        const expectedFrozenChanges = [
            0, // Proxy
            -dealPrice, // Requester
            -schedulerStakePerTask, // Scheduler
            0, // AppProvider
            0, // DatasetProvider
            0, // Worker
        ];
        await checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
    });

    describe('Integration tests array of worker', function () {
        for (let workerNumber = 2; workerNumber < 6; workerNumber++) {
            it(`[6.${workerNumber - 1}] No sponsorship, no beneficiary, no callback, no BoT, up to ${workerNumber} workers`, async function () {
                const volume = 1;
                const disposableWorkers = [worker1, worker2, worker3, worker4, worker5];
                const workers = disposableWorkers.slice(0, workerNumber);
                const accounts = [requester, scheduler, appProvider, datasetProvider, ...workers];
                // Create deal.
                const orders = buildOrders({
                    assets: ordersAssets,
                    prices: ordersPrices,
                    requester: requester.address,
                    tag: standardDealTag,
                    volume,
                    trust: workerNumber ** 2 - 1,
                });
                const { dealId, dealPrice, schedulerStakePerDeal } =
                    await iexecWrapper.signAndMatchOrders(...orders.toArray());
                const taskPrice = appPrice + datasetPrice + workerpoolPrice;
                const schedulerStakePerTask = schedulerStakePerDeal / volume;
                const workersRewardPerTask = await iexecWrapper.computeWorkersRewardPerTask(
                    dealId,
                    PocoMode.CLASSIC,
                );
                const schedulerRewardPerTask = workerpoolPrice - workersRewardPerTask;
                const accountsInitialFrozens = await getInitialFrozens(accounts);

                for (let i = 0; i < workerNumber; i++) {
                    expect(await iexecPoco.viewScore(workers[i].address)).to.be.equal(0);
                }
                const taskId = await iexecWrapper.initializeTask(dealId, 0);
                // Finalize each task and check balance changes.
                const workerStake = await iexecPoco
                    .viewDeal(dealId)
                    .then((deal) => deal.workerStake.toNumber());

                for (let i = 0; i < workerNumber; i++) {
                    await iexecWrapper.contributeToTask(dealId, 0, resultDigest, workers[i]);
                }
                for (let i = 0; i < workerNumber; i++) {
                    await iexecPoco
                        .connect(workers[i])
                        .reveal(taskId, resultDigest)
                        .then((tx) => tx.wait());
                }
                const finalizeTx = await iexecPoco
                    .connect(scheduler)
                    .finalize(taskId, results, '0x');
                await finalizeTx.wait();
                const expectedProxyBalanceChange = -(
                    dealPrice +
                    schedulerStakePerTask +
                    workerStake * workers.length
                );
                const expectedWorkerBalanceChange =
                    workerStake + workersRewardPerTask / workerNumber;
                await expect(finalizeTx).to.changeTokenBalances(
                    iexecPoco,
                    [proxyAddress, ...accounts],
                    [
                        expectedProxyBalanceChange,
                        0,
                        schedulerStakePerTask + schedulerRewardPerTask,
                        appPrice,
                        datasetPrice,
                        ...workers.map(() => expectedWorkerBalanceChange), // Workers
                    ],
                );
                expect((await iexecPoco.viewTask(taskId)).status).to.equal(
                    TaskStatusEnum.COMPLETED,
                );
                const expectedFrozenChanges = [
                    0,
                    -taskPrice,
                    -schedulerStakePerTask,
                    0,
                    0,
                    ...workers.map(() => 0),
                ];
                await checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
                for (let i = 0; i < workerNumber; i++) {
                    expect(await iexecPoco.viewScore(workers[i].address)).to.be.equal(
                        workerNumber == 1 ? 0 : 1,
                    );
                }
            });
        }
    });
    it(`[7] No sponsorship, no beneficiary, no callback, no BoT, up to 5 workers with 1 bad worker`, async function () {
        const volume = 1;
        const workersAvailable = [worker1, worker2, worker3, worker4, worker5];
        const { resultDigest: badResultDigest } = buildUtf8ResultAndDigest('bad-result');
        const losingWorker = worker1;
        const winningWorkers = workersAvailable.slice(1, workersAvailable.length);
        let contributions = [{ signer: worker1, resultDigest: badResultDigest }];
        for (const worker of winningWorkers) {
            contributions.push({ signer: worker, resultDigest: resultDigest });
        }
        const accounts = [
            requester,
            scheduler,
            appProvider,
            datasetProvider,
            losingWorker,
            ...winningWorkers,
        ];
        // Create deal.
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: standardDealTag,
            volume,
            trust: winningWorkers.length,
        });

        const { dealId, dealPrice, schedulerStakePerDeal } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        const accountsInitialFrozens = await getInitialFrozens(accounts);
        // Check initial balances.
        for (const contributor of contributions) {
            expect(await iexecPoco.viewScore(contributor.signer.address)).to.be.equal(0);
        }
        const taskId = await iexecWrapper.initializeTask(dealId, 0);
        // Finalize task and check balance changes.
        const workerStake = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        for (const contributor of contributions) {
            await iexecWrapper.contributeToTask(
                dealId,
                0,
                contributor.resultDigest,
                contributor.signer,
            );
        }
        // verify that the bad worker can't reveal.
        await expect(
            iexecPoco.connect(losingWorker).reveal(taskId, badResultDigest),
        ).to.be.revertedWithoutReason();
        for (const winningWorker of winningWorkers) {
            await iexecPoco
                .connect(winningWorker)
                .reveal(taskId, resultDigest)
                .then((tx) => tx.wait());
        }
        const finalizeTx = await iexecPoco.connect(scheduler).finalize(taskId, results, '0x');
        await finalizeTx.wait();

        const totalWorkerPoolReward = workerpoolPrice + workerStake * 1; // bad wrokers lose their stake and add it to the pool price
        // compute expected worker reward for current task
        const workersRewardPerTask = await computeWorkerRewardForCurrentTask(
            totalWorkerPoolReward,
            dealId,
        );
        const expectedWorkerBalanceChange =
            workerStake + workersRewardPerTask / winningWorkers.length;
        // compute expected scheduler reward for current task
        const schedulerRewardPerTask = totalWorkerPoolReward - workersRewardPerTask;
        const expectedSchedulerBalanceChange = schedulerStakePerTask + schedulerRewardPerTask;

        const expectedProxyBalanceChange = -(
            dealPrice +
            workerStake * workersAvailable.length +
            schedulerStakePerTask
        );
        await expect(finalizeTx).to.changeTokenBalances(
            iexecPoco,
            [proxyAddress, ...accounts],
            [
                expectedProxyBalanceChange,
                0,
                expectedSchedulerBalanceChange,
                appPrice,
                datasetPrice,
                0, // losing worker
                ...winningWorkers.map(() => expectedWorkerBalanceChange), // winning workers
            ],
        );
        // checks on losing worker
        expect(await iexecPoco.viewScore(losingWorker.address)).to.be.equal(0);
        // checks on winning workers
        for (const winningWorker of winningWorkers) {
            expect(await iexecPoco.viewScore(winningWorker.address)).to.be.equal(1);
        }
        // verify task status
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);
        // checks on frozen balance changes
        const expectedFrozenChanges = [
            0,
            -dealPrice,
            -schedulerStakePerTask,
            0,
            0,
            ...workersAvailable.map(() => 0),
        ];
        await checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
    });

    async function getInitialFrozens(accounts: SignerWithAddress[]) {
        let initialFrozens = [
            {
                address: proxyAddress,
                frozen: (await iexecPoco.frozenOf(proxyAddress)).toNumber(),
            },
        ];
        for (const account of accounts) {
            initialFrozens.push({
                address: account.address,
                frozen: (await iexecPoco.frozenOf(account.address)).toNumber(),
            });
        }
        return initialFrozens;
    }

    async function computeWorkerRewardForCurrentTask(totalPoolReward: number, dealId: string) {
        const deal = await iexecPoco.viewDeal(dealId);
        return (totalPoolReward * (100 - deal.schedulerRewardRatio.toNumber())) / 100;
    }
});

async function checkFrozenChanges(
    accountsInitialFrozens: { address: string; frozen: number }[],
    expectedFrozenChanges: number[],
) {
    for (let i = 0; i < accountsInitialFrozens.length; i++) {
        const message = `Failed with account at index ${i}`;
        expect(await iexecPoco.frozenOf(accountsInitialFrozens[i].address)).to.equal(
            accountsInitialFrozens[i].frozen + expectedFrozenChanges[i],
            message,
        );
    }
}
