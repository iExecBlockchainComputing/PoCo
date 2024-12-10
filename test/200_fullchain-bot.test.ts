// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../typechain';
import { OrdersActors, OrdersAssets, OrdersPrices, buildOrders } from '../utils/createOrders';
import { TaskStatusEnum, buildUtf8ResultAndDigest, getIexecAccounts } from '../utils/poco-tools';
import { IexecWrapper } from './utils/IexecWrapper';

const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;

let proxyAddress: string;
let iexecPoco: IexecInterfaceNative;
let iexecWrapper: IexecWrapper;
let [appAddress, workerpoolAddress, datasetAddress]: string[] = [];
let [
    requester,
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

    it('Task Lifecycle with BoT Replication and Error Handling', async function () {
        const workers = [worker1, worker2, worker3, worker4, worker5];
        // Create deal.
        const volume = 3;
        const tasksAndWorkers: {
            [key: number]: {
                worker: SignerWithAddress;
                useEnclave: boolean;
                result: string;
            }[];
        } = {
            0: [
                { worker: worker1, useEnclave: false, result: 'iExec BOT 0' },
                { worker: worker2, useEnclave: false, result: 'iExec BOT 0' },
            ],
            1: [
                { worker: worker2, useEnclave: true, result: 'iExec BOT 1' },
                { worker: worker3, useEnclave: true, result: 'iExec BOT 1' },
            ],
            2: [
                { worker: worker1, useEnclave: false, result: 'iExec BOT 2' },
                { worker: worker3, useEnclave: false, result: '<bad contribution>' },
                { worker: worker2, useEnclave: true, result: 'iExec BOT 2' },
                { worker: worker4, useEnclave: true, result: 'iExec BOT 2' },
                { worker: worker5, useEnclave: true, result: 'iExec BOT 2' },
            ],
        };
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: standardDealTag,
            volume,
            trust: 4,
        });
        const { dealId, dealPrice, schedulerStakePerDeal } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        const taskPrice = appPrice + datasetPrice + workerpoolPrice;
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        // Save frozens
        const accounts = [requester, scheduler, appProvider, datasetProvider];
        const accountsInitialFrozens = await getInitialFrozens([...accounts, ...workers]);
        // Track initial scores
        // Finalize each task and check balance changes.
        const workerStakePerTask = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        for (let taskIndex = 0; taskIndex < volume; taskIndex++) {
            const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
            const initialScores = await getInitialScores(workers);
            const contributions = tasksAndWorkers[taskIndex];
            for (const contribution of contributions) {
                const { worker, useEnclave, result } = contribution;
                const { resultDigest } = buildUtf8ResultAndDigest(result);

                if (useEnclave) {
                    await iexecWrapper.contributeToTeeTask(dealId, taskIndex, resultDigest, worker);
                } else {
                    await iexecWrapper.contributeToTask(dealId, taskIndex, resultDigest, worker);
                }
            }
            // Reveal contributions for all workers
            for (const contribution of contributions) {
                const { worker, result } = contribution;
                const { resultDigest } = buildUtf8ResultAndDigest(result);
                if (result !== '<bad contribution>') {
                    await iexecPoco
                        .connect(worker)
                        .reveal(taskId, resultDigest)
                        .then((tx) => tx.wait());
                }
            }
            const { results } = buildUtf8ResultAndDigest(tasksAndWorkers[taskIndex][0].result);
            const finalizeTx = await iexecPoco.connect(scheduler).finalize(taskId, results, '0x');
            await finalizeTx.wait();
            expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);
            // Verify token balance changes
            const winningWorkers = contributions
                .filter(
                    (contribution) => contribution.result === 'iExec BOT ' + taskIndex.toString(),
                )
                .map((contribution) => contribution.worker);
            const loosingWorkers = contributions
                .filter(
                    (contribution) => contribution.result !== 'iExec BOT ' + taskIndex.toString(),
                )
                .map((contribution) => contribution.worker);
            const nonParticipantWorkers = workers.filter(
                (worker) => !winningWorkers.includes(worker) && !loosingWorkers.includes(worker),
            );
            const participantWorkers = workers.filter(
                (worker) => !nonParticipantWorkers.includes(worker),
            );
            const totalWorkerPoolReward =
                workerpoolPrice + workerStakePerTask * loosingWorkers.length; // bad wrokers lose their stake and add it to the pool price
            // compute expected worker reward for current task
            const workersRewardPerTask = await computeWorkersRewardForCurrentTask(
                totalWorkerPoolReward,
                dealId,
            );
            const expectedWinningWorkerBalanceChange =
                workerStakePerTask + workersRewardPerTask / winningWorkers.length;
            // compute expected scheduler reward for current task
            const schedulerRewardPerTask = totalWorkerPoolReward - workersRewardPerTask;
            const expectedSchedulerBalanceChange = schedulerStakePerTask + schedulerRewardPerTask;

            const expectedProxyBalanceChange = -(
                taskPrice +
                workerStakePerTask * participantWorkers.length +
                schedulerStakePerTask
            );

            await expect(finalizeTx).to.changeTokenBalances(
                iexecPoco,
                [
                    proxyAddress,
                    ...accounts,
                    ...winningWorkers,
                    ...loosingWorkers,
                    ...nonParticipantWorkers,
                ],
                [
                    expectedProxyBalanceChange, // Proxy
                    -0, // Requester
                    expectedSchedulerBalanceChange, // Scheduler
                    appPrice, // AppProvider
                    datasetPrice, // DatasetProvider
                    ...winningWorkers.map(() => expectedWinningWorkerBalanceChange), // winning workers
                    ...loosingWorkers.map(() => 0), // loosing workers
                    ...nonParticipantWorkers.map(() => 0), // non participant workers
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
            await validateScores(
                initialScores,
                winningWorkers,
                loosingWorkers,
                nonParticipantWorkers,
            );
        }
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

    async function getInitialScores(
        workers: SignerWithAddress[],
    ): Promise<{ [address: string]: number }> {
        const scores: { [address: string]: number } = {};
        for (const worker of workers) {
            scores[worker.address] = (await iexecPoco.viewScore(worker.address)).toNumber();
        }
        return scores;
    }

    async function computeWorkersRewardForCurrentTask(totalPoolReward: number, dealId: string) {
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

async function validateScores(
    initialScores: { [address: string]: number },
    winningWorkers: SignerWithAddress[],
    loosingWorkers: SignerWithAddress[],
    nonParticipantWorkers: SignerWithAddress[],
) {
    for (const winningWorker of winningWorkers) {
        const currentScore = (await iexecPoco.viewScore(winningWorker.address)).toNumber();
        expect(currentScore, `Worker ${winningWorker.address} score mismatch`).to.equal(
            initialScores[winningWorker.address] + 1,
        );
    }
    for (const loosingWorker of loosingWorkers) {
        const currentScore = (await iexecPoco.viewScore(loosingWorker.address)).toNumber();
        expect(currentScore, `Worker ${loosingWorker.address} score mismatch`).to.equal(
            initialScores[loosingWorker.address] - 1,
        );
    }
    for (const nonParticipantWorker of nonParticipantWorkers) {
        const currentScore = (await iexecPoco.viewScore(nonParticipantWorker.address)).toNumber();
        expect(currentScore, `Worker ${nonParticipantWorker.address} score mismatch`).to.equal(
            initialScores[nonParticipantWorker.address],
        );
    }
}
