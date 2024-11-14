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

//  +---------+-------------+-------------+-------------+----------+-----+----------------+
//  |         | Sponsorship | Replication | Beneficiary | Callback | BoT |      Type      |
//  +---------+-------------+-------------+-------------+----------+-----+----------------+
//  |   [1]   |     ✔       |     ✔       |     ✔       |    ✔     |  ✔  |   Standard     |
//  |   [2]   |     x       |     ✔       |     ✔       |    ✔     |  ✔  |   Standard     |
//  |   [3]   |     ✔       |     x       |     ✔       |    ✔     |  ✔  |  Standard,TEE  |
//  |   [4]   |     x       |     x       |     ✔       |    ✔     |  ✔  |  Standard,TEE  |
//  |   [5]   |     x       |     x       |     x       |    x     |  x  |  Standard,TEE  |
//  |   [6]   |     x       |     ✔       |     x       |    x     |  x  |  Standard,TEE X goods |
//  |   [7]   |     x       |     ✔       |     x       |    x     |  x  |  Standard,TEE goods Y 1 bad |
//  +---------+-------------+-------------+----------+-----+-------------+----------------+

const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const callbackAddress = ethers.Wallet.createRandom().address;
const { results } = buildUtf8ResultAndDigest('result');
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
                    dealPrice + schedulerStakePerDeal - (taskPrice + schedulerStakePerTask),
                accounts: [
                    { signer: sponsor, balance: 0, frozen: dealPrice - taskPrice },
                    { signer: requester, balance: 0, frozen: 0 },
                    {
                        signer: scheduler,
                        balance: schedulerStakePerTask + schedulerRewardPerTask,
                        frozen: schedulerStakePerDeal - schedulerStakePerTask,
                    },
                    { signer: appProvider, balance: appPrice, frozen: 0 },
                    { signer: datasetProvider, balance: datasetPrice, frozen: 0 },
                    {
                        signer: worker1,
                        balance: workerStakePerTask + workerRewardPerTask,
                        frozen: 0,
                    },
                ],
            });
        }
    });

    // TODO implement the following tests.

    it('[2] No sponsorship, beneficiary, callback, BoT, replication', async function () {
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
        const { dealId, dealPrice, schedulerStakePerDeal } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
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
                { signer: requester, balance: 0, frozen: dealPrice },
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
            //   - Requester
            //      - frozen: frozenBefore - taskPrice
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
                    dealPrice + schedulerStakePerDeal - (taskPrice + schedulerStakePerTask),
                accounts: [
                    { signer: requester, balance: 0, frozen: dealPrice - taskPrice },
                    {
                        signer: scheduler,
                        balance: schedulerStakePerTask + schedulerRewardPerTask,
                        frozen: schedulerStakePerDeal - schedulerStakePerTask,
                    },
                    { signer: appProvider, balance: appPrice, frozen: 0 },
                    { signer: datasetProvider, balance: datasetPrice, frozen: 0 },
                    {
                        signer: worker1,
                        balance: workerStakePerTask + workerRewardPerTask,
                        frozen: 0,
                    },
                ],
            });
        }
    });

    it('[3] Sponsorship, beneficiary, callback, BoT, no replication', async function () {});

    it('[4] No sponsorship, beneficiary, callback, BoT, no replication', async function () {});

    it('[5] No sponsorship, no beneficiary, no callback, no BoT, no replication', async function () {});

    describe.only('Integration tests array of worker', function () {
        for (let workerNumber = 1; workerNumber < 5; workerNumber++) {
            it(`[6.${workerNumber}] No sponsorship, no beneficiary, no callback, no BoT, up to ${workerNumber} workers`, async function () {
                const volume = 1;
                const disposableWokers = [worker1, worker2, worker3, worker4, worker5];
                let workers = [];
                for (let i = 0; i < workerNumber; i++) {
                    workers.push(disposableWokers[i]);
                }
                // Create deal.
                const orders = buildOrders({
                    assets: ordersAssets,
                    prices: ordersPrices,
                    requester: requester.address,
                    tag: standardDealTag,
                    beneficiary: beneficiary.address,
                    callback: callbackAddress,
                    volume,
                    trust: workerNumber,
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
                // TODO save initial balances and use them in for loop for comparison.
                let accounts = [
                    { signer: requester, balance: 0, frozen: dealPrice },
                    { signer: scheduler, balance: 0, frozen: schedulerStakePerDeal },
                    { signer: appProvider, balance: 0, frozen: 0 },
                    { signer: datasetProvider, balance: 0, frozen: 0 },
                ];
                for (let i = 0; i < workerNumber; i++) {
                    accounts.push({ signer: workers[i], balance: 0, frozen: 0 });
                }
                await checkBalancesAndFrozens({
                    proxyBalance: dealPrice + schedulerStakePerDeal,
                    accounts,
                });
                const taskId = await iexecWrapper.initializeTask(dealId, 0);
                // Finalize each task and check balance changes.
                let workerStake: number = 0;
                for (let i = 0; i < workerNumber; i++) {
                    console.log('worker ' + i + ' is contributing');
                    const { workerStakePerTask } = await iexecWrapper.contributeToTask(
                        dealId,
                        0,
                        callbackResultDigest,
                        workers[i],
                    );
                    await iexecPoco
                        .connect(workers[i])
                        .reveal(taskId, callbackResultDigest)
                        .then((tx) => tx.wait());
                    workerStake = workerStakePerTask;
                }
                await iexecPoco
                    .connect(scheduler)
                    .finalize(taskId, results, resultsCallback)
                    .then((tx) => tx.wait());
                expect((await iexecPoco.viewTask(taskId)).status).to.equal(
                    TaskStatusEnum.COMPLETED,
                );
                // Multiply amount by the number of finalized tasks to correctly compute
                // stake and reward amounts.

                // For each task, balances change such as:
                //   - Requester
                //      - frozen: frozenBefore - taskPrice
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
                accounts = [
                    { signer: requester, balance: 0, frozen: dealPrice - taskPrice },
                    {
                        signer: scheduler,
                        balance: schedulerStakePerTask + schedulerRewardPerTask,
                        frozen: schedulerStakePerDeal - schedulerStakePerTask,
                    },
                    { signer: appProvider, balance: appPrice, frozen: 0 },
                    { signer: datasetProvider, balance: datasetPrice, frozen: 0 },
                ];
                for (let i = 0; i < workerNumber; i++) {
                    accounts.push({
                        signer: disposableWokers[i],
                        balance: workerStake + workerRewardPerTask,
                        frozen: 0,
                    });
                }
                await checkBalancesAndFrozens({
                    proxyBalance: 0,
                    accounts,
                });
            });
        }
    });

    it('[6] No sponsorship, no beneficiary, no callback, no BoT, up to 5 workers', async function () {
        const volume = 1;
        let workers = [];
        const disposableWokers = [worker1, worker2, worker3, worker4, worker5];

        for (let workerNumber = 1; workerNumber < 3; workerNumber++) {}
    });

    it('[7] No sponsorship, no beneficiary, no callback, no BoT, up to 5 workers with 1 bad actor', async function () {});
});

async function checkBalancesAndFrozens(args: {
    proxyBalance: number;
    accounts: { signer: SignerWithAddress; balance: number; frozen: number }[];
}) {
    console.log('Checking balances... => proxy first');
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
