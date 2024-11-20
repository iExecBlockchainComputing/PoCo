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
//  |   [6.x] |     x       |     ✔       |     x       |    x     |  x  |  Standard,TEE, X good workers               |
//  |   [7.x] |     x       |     ✔       |     x       |    x     |  x  |  Standard,TEE, X good workers 1 bad worker  |
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
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: standardDealTag,
            beneficiary: beneficiary.address,
            callback: callbackAddress,
            volume,
            trust: 1, // TODO use 5 workers.
        });
        const { dealId, dealPrice, schedulerStakePerDeal } =
            await iexecWrapper.signAndSponsorMatchOrders(...orders.toArray());
        const taskPrice = appPrice + datasetPrice + workerpoolPrice;
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        const workerRewardPerTask = await iexecWrapper.computeWorkerRewardPerTask(
            dealId,
            PocoMode.CLASSIC,
        );
        const schedulerRewardPerTask = workerpoolPrice - workerRewardPerTask;
        // Check initial balances.
        // TODO save initial balances and use them in for loop for comparison.
        await checkBalancesAndFrozens({
            proxyBalance: dealPrice + schedulerStakePerDeal,
            accounts: [
                { signer: sponsor, balance: 0, frozen: dealPrice },
                { signer: requester, balance: 0, frozen: 0 },
                { signer: scheduler, balance: 0, frozen: schedulerStakePerDeal },
                { signer: appProvider, balance: 0, frozen: 0 },
                { signer: datasetProvider, balance: 0, frozen: 0 },
                { signer: worker1, balance: 0, frozen: 0 },
            ],
        });
        // Finalize each task and check balance changes.
        for (let taskIndex = 0; taskIndex < volume; taskIndex++) {
            const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
            const { workerStakePerTask } = await iexecWrapper.contributeToTask(
                dealId,
                taskIndex,
                callbackResultDigest,
                worker1,
            );
            await iexecPoco
                .connect(worker1)
                .reveal(taskId, callbackResultDigest)
                .then((tx) => tx.wait());
            await iexecPoco
                .connect(scheduler)
                .finalize(taskId, results, resultsCallback)
                .then((tx) => tx.wait());
            expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);
            // Multiply amount by the number of finalized tasks to correctly compute
            // stake and reward amounts.
            const completedTasks = taskIndex + 1;
            // For each task, balances change such as:
            //   - Sponsor
            //      - frozen: frozenBefore - taskPrice
            //   - Requester: no changes
            //   - Scheduler
            //      - balance: balanceBefore + taskStake + taskReward
            //      - frozen: frozenBefore - taskStake
            //   - App
            //      - balance: balance before + appPrice
            //   - Dataset
            //      - balance: balance before + datasetPrice
            //   - Worker:
            //      - balance: balance before + taskStake + taskReward
            //      - frozen: frozen before - taskStake
            await checkBalancesAndFrozens({
                proxyBalance:
                    dealPrice +
                    schedulerStakePerDeal -
                    (taskPrice + schedulerStakePerTask) * completedTasks,
                accounts: [
                    { signer: sponsor, balance: 0, frozen: dealPrice - taskPrice * completedTasks },
                    { signer: requester, balance: 0, frozen: 0 },
                    {
                        signer: scheduler,
                        balance: (schedulerStakePerTask + schedulerRewardPerTask) * completedTasks,
                        frozen: schedulerStakePerDeal - schedulerStakePerTask * completedTasks,
                    },
                    { signer: appProvider, balance: appPrice * completedTasks, frozen: 0 },
                    { signer: datasetProvider, balance: datasetPrice * completedTasks, frozen: 0 },
                    {
                        signer: worker1,
                        balance: (workerStakePerTask + workerRewardPerTask) * completedTasks,
                        frozen: 0,
                    },
                ],
            });
        }
    });

    // TODO implement the following tests.

    it('[2] No sponsorship, beneficiary, callback, BoT, replication', async function () {});

    it('[3] Sponsorship, beneficiary, callback, BoT, no replication', async function () {});

    it('[4] No sponsorship, beneficiary, callback, BoT, no replication', async function () {});

    it('[5] No sponsorship, no beneficiary, no callback, no BoT, no replication', async function () {});

    describe('Integration tests array of worker', function () {
        for (let workerNumber = 1; workerNumber < 6; workerNumber++) {
            it(`[6.${workerNumber}] No sponsorship, no beneficiary, no callback, no BoT, up to ${workerNumber} workers`, async function () {
                const volume = 1;
                const disposableWorkers = [worker1, worker2, worker3, worker4, worker5];
                const workers = disposableWorkers.slice(0, workerNumber);
                const acounts = [requester, scheduler, appProvider, datasetProvider, ...workers];
                // Create deal.
                const orders = buildOrders({
                    assets: ordersAssets,
                    prices: ordersPrices,
                    requester: requester.address,
                    tag: standardDealTag,
                    beneficiary: beneficiary.address,
                    volume,
                    trust: workerNumber ** 2 - 1,
                });
                const { dealId, dealPrice, schedulerStakePerDeal } =
                    await iexecWrapper.signAndMatchOrders(...orders.toArray());
                const taskPrice = appPrice + datasetPrice + workerpoolPrice;
                const schedulerStakePerTask = schedulerStakePerDeal / volume;
                const workerRewardPerTask = await iexecWrapper.computeWorkerRewardPerTask(
                    dealId,
                    PocoMode.CLASSIC,
                );
                const schedulerRewardPerTask = workerpoolPrice - workerRewardPerTask;
                // Check initial balances.
                let accountsInitBalances = [
                    {
                        address: proxyAddress,
                        frozen: (await iexecPoco.frozenOf(proxyAddress)).toNumber(),
                    },
                ];
                for (const account of acounts) {
                    let address = account.address;
                    let frozen = (await iexecPoco.frozenOf(account.address)).toNumber();
                    accountsInitBalances.push({ address, frozen });
                }
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
                expect(finalizeTx).to.changeTokenBalances(
                    iexecPoco,
                    [proxyAddress, requester, scheduler, appProvider, datasetProvider],
                    [
                        -(dealPrice + schedulerStakePerDeal),
                        0,
                        schedulerStakePerTask + schedulerRewardPerTask,
                        appPrice,
                        datasetPrice,
                    ],
                );
                for (let i = 0; i < workerNumber; i++) {
                    expect(finalizeTx).to.changeTokenBalances(
                        iexecPoco,
                        [workers[i]],
                        [workerStake + workerRewardPerTask / workerNumber],
                    );
                }
                expect((await iexecPoco.viewTask(taskId)).status).to.equal(
                    TaskStatusEnum.COMPLETED,
                );
                const expectedFrozenChanges = [0, -taskPrice, -schedulerStakePerTask, 0, 0];
                for (let i = 0; i < workerNumber; i++) {
                    expectedFrozenChanges.push(0);
                }
                await changesInFrozen({
                    accountsInitBalances,
                    frozenChanges: expectedFrozenChanges,
                });
                for (let i = 0; i < workerNumber; i++) {
                    expect(await iexecPoco.viewScore(workers[i].address)).to.be.equal(
                        workerNumber == 1 ? 0 : 1,
                    );
                }
            });
        }
        for (let workerNumber = 4; workerNumber < 6; workerNumber++) {
            // Worker1 will contribute badly
            it(`[7.${workerNumber - 3}] No sponsorship, no beneficiary, no callback, no BoT, up to ${workerNumber} workers with 1 bad actor`, async function () {
                const volume = 1;
                const workersAvailable = [worker1, worker2, worker3, worker4, worker5];
                const { resultDigest: badResultDigest } = buildUtf8ResultAndDigest('bad-result');
                const losingWorker = worker1;
                const winningWorkers = workersAvailable.slice(1, workerNumber);
                let workers = [{ signer: worker1, resultDigest: badResultDigest }];
                for (const worker of winningWorkers) {
                    workers.push({ signer: worker, resultDigest: resultDigest });
                }
                const acounts = [
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
                    beneficiary: beneficiary.address,
                    volume,
                    trust: winningWorkers.length,
                });

                const { dealId, dealPrice, schedulerStakePerDeal } =
                    await iexecWrapper.signAndMatchOrders(...orders.toArray());
                const taskPrice = appPrice + datasetPrice + workerpoolPrice;
                const schedulerStakePerTask = schedulerStakePerDeal / volume;
                const workerRewardPerTask = await iexecWrapper.computeWorkerRewardPerTask(
                    dealId,
                    PocoMode.CLASSIC,
                );
                const schedulerRewardPerTask = workerpoolPrice - workerRewardPerTask;
                // Check initial balances.
                let accountsInitBalances = [
                    {
                        address: proxyAddress,
                        frozen: (await iexecPoco.frozenOf(proxyAddress)).toNumber(),
                    },
                ];
                for (const account of acounts) {
                    let address = account.address;
                    let frozen = (await iexecPoco.frozenOf(account.address)).toNumber();
                    accountsInitBalances.push({ address, frozen });
                }
                for (const worker of workers) {
                    expect(await iexecPoco.viewScore(worker.signer.address)).to.be.equal(0);
                }
                const taskId = await iexecWrapper.initializeTask(dealId, 0);
                // Finalize each task and check balance changes.
                const workerStake = await iexecPoco
                    .viewDeal(dealId)
                    .then((deal) => deal.workerStake.toNumber());
                for (const worker of workers) {
                    await iexecWrapper.contributeToTask(
                        dealId,
                        0,
                        worker.resultDigest,
                        worker.signer,
                    );
                }
                for (const winningWorker of winningWorkers) {
                    await iexecPoco
                        .connect(winningWorker)
                        .reveal(taskId, resultDigest)
                        .then((tx) => tx.wait());
                }
                const finalizeTx = await iexecPoco
                    .connect(scheduler)
                    .finalize(taskId, results, '0x');
                expect(finalizeTx).to.changeTokenBalances(
                    iexecPoco,
                    [proxyAddress, requester, scheduler, appProvider, datasetProvider],
                    [
                        -(dealPrice + schedulerStakePerDeal),
                        0,
                        schedulerStakePerTask + schedulerRewardPerTask,
                        appPrice,
                        datasetPrice,
                    ],
                );
                // checks on losing worker
                expect(finalizeTx).to.changeTokenBalances(iexecPoco, [losingWorker], [0]);
                expect(await iexecPoco.viewScore(losingWorker.address)).to.be.equal(0);
                // checks on winning workers
                for (const winningWorker of winningWorkers) {
                    expect(finalizeTx).to.changeTokenBalances(
                        iexecPoco,
                        [winningWorker.address],
                        [workerStake + workerRewardPerTask / winningWorkers.length],
                    );
                    expect(await iexecPoco.viewScore(winningWorker.address)).to.be.equal(1);
                }
                // verify task status
                expect((await iexecPoco.viewTask(taskId)).status).to.equal(
                    TaskStatusEnum.COMPLETED,
                );
                // checks on frozen balance changes
                const expectedFrozenChanges = [0, -taskPrice, -schedulerStakePerTask, 0, 0];
                for (let i = 0; i < workerNumber; i++) {
                    expectedFrozenChanges.push(0);
                }
                await changesInFrozen({
                    accountsInitBalances,
                    frozenChanges: expectedFrozenChanges,
                });
            });
        }
    });
});

async function checkBalancesAndFrozens(args: {
    proxyBalance: number;
    accounts: { signer: SignerWithAddress; balance: number; frozen: number }[];
}) {
    expect(await iexecPoco.balanceOf(proxyAddress)).to.equal(args.proxyBalance);
    for (const account of args.accounts) {
        const message = `Failed with account at index ${args.accounts.indexOf(account)}`;
        expect(await iexecPoco.balanceOf(account.signer.address)).to.equal(
            account.balance,
            message,
        );
        expect(await iexecPoco.frozenOf(account.signer.address)).to.equal(account.frozen, message);
    }
}

async function changesInFrozen(args: {
    accountsInitBalances: { address: string; frozen: number }[];
    frozenChanges: number[];
}) {
    for (let i = 0; i < args.accountsInitBalances.length; i++) {
        const message = `Failed with account at index ${i}`;
        expect(await iexecPoco.frozenOf(args.accountsInitBalances[i].address)).to.equal(
            args.accountsInitBalances[i].frozen + args.frozenChanges[i],
            message,
        );
    }
}
