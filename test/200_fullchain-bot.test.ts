// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../typechain';
import { TAG_STANDARD } from '../utils/constants';
import { OrdersActors, OrdersAssets, OrdersPrices, buildOrders } from '../utils/createOrders';
import { TaskStatusEnum, buildUtf8ResultAndDigest, getIexecAccounts } from '../utils/poco-tools';
import { IexecWrapper } from './utils/IexecWrapper';
import { loadHardhatFixtureDeployment } from './utils/hardhat-fixture-deployer';

const appPrice = 1000n;
const datasetPrice = 1_000_000n;
const workerpoolPrice = 1_000_000_000n;

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
        const volume = 3n;
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
            tag: TAG_STANDARD,
            volume,
            trust: 4n,
        });
        const { dealId, dealPrice, schedulerStakePerDeal } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        const taskPrice = appPrice + datasetPrice + workerpoolPrice;
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        // Save frozens
        const accounts = [requester, scheduler, appProvider, datasetProvider];
        const accountsInitialFrozens = await iexecWrapper.getInitialFrozens([
            ...accounts,
            ...workers,
        ]);
        // Track initial scores
        // Finalize each task and check balance changes.
        const workerStakePerTask = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake);
        for (let taskIndex = 0n; taskIndex < volume; taskIndex++) {
            const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
            const initialScores = await getInitialScores(workers);
            const contributions = tasksAndWorkers[Number(taskIndex)];
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
            const { results } = buildUtf8ResultAndDigest(
                tasksAndWorkers[Number(taskIndex)][0].result,
            );
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
                workerpoolPrice + workerStakePerTask * BigInt(loosingWorkers.length); // bad wrokers lose their stake and add it to the pool price
            // compute expected worker reward for current task
            const workersRewardPerTask = await iexecWrapper.computeWorkersRewardForCurrentTask(
                totalWorkerPoolReward,
                dealId,
            );
            const expectedWinningWorkerBalanceChange =
                workerStakePerTask + workersRewardPerTask / BigInt(winningWorkers.length);
            // compute expected scheduler reward for current task
            const schedulerRewardPerTask = totalWorkerPoolReward - workersRewardPerTask;
            const expectedSchedulerBalanceChange = schedulerStakePerTask + schedulerRewardPerTask;

            const expectedProxyBalanceChange = -(
                taskPrice +
                workerStakePerTask * BigInt(participantWorkers.length) +
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
            const completedTasks = taskIndex + 1n;
            // Calculate expected frozen changes
            const expectedFrozenChanges = [
                -taskPrice * completedTasks, // Requester
                -schedulerStakePerTask * completedTasks, // Scheduler
                0n, // AppProvider
                0n, // DatasetProvider
                ...workers.map(() => 0n), // Add 0 for each worker
            ];
            await iexecWrapper.checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
            await validateScores(
                initialScores,
                winningWorkers,
                loosingWorkers,
                nonParticipantWorkers,
            );
        }
    });

    async function getInitialScores(
        workers: SignerWithAddress[],
    ): Promise<{ [address: string]: bigint }> {
        const scores: { [address: string]: bigint } = {};
        for (const worker of workers) {
            scores[worker.address] = await iexecPoco.viewScore(worker.address);
        }
        return scores;
    }
});

async function validateScores(
    initialScores: { [address: string]: bigint },
    winningWorkers: SignerWithAddress[],
    loosingWorkers: SignerWithAddress[],
    nonParticipantWorkers: SignerWithAddress[],
) {
    for (const winningWorker of winningWorkers) {
        const currentScore = await iexecPoco.viewScore(winningWorker.address);
        expect(currentScore, `Worker ${winningWorker.address} score mismatch`).to.equal(
            initialScores[winningWorker.address] + 1n,
        );
    }
    for (const loosingWorker of loosingWorkers) {
        const currentScore = await iexecPoco.viewScore(loosingWorker.address);
        expect(currentScore, `Worker ${loosingWorker.address} score mismatch`).to.equal(
            initialScores[loosingWorker.address] - 1n,
        );
    }
    for (const nonParticipantWorker of nonParticipantWorkers) {
        const currentScore = await iexecPoco.viewScore(nonParticipantWorker.address);
        expect(currentScore, `Worker ${nonParticipantWorker.address} score mismatch`).to.equal(
            initialScores[nonParticipantWorker.address],
        );
    }
}
