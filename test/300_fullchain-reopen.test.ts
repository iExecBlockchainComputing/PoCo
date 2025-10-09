// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { ZeroAddress } from 'ethers';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../typechain';
import { OrdersActors, OrdersAssets, OrdersPrices, buildOrders } from '../utils/createOrders';
import { loadHardhatFixtureDeployment } from './utils/hardhat-fixture-deployer';

import {
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
} from '../utils/poco-tools';
import { IexecWrapper } from './utils/IexecWrapper';
import { TAG_STANDARD } from '../utils/constants';

const appPrice = 1000n;
const datasetPrice = 1_000_000n;
const workerpoolPrice = 1_000_000_000n;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');

let proxyAddress: string;
let [iexecPoco, iexecPocoAsScheduler]: IexecInterfaceNative[] = [];
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
        } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsScheduler = iexecPoco.connect(scheduler);
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
     * This test checks the full lifecycle of a task with reveal deadline reached
     * and reopen operation taking place:
     * - Create a deal with specific orders and initialize a task.
     * - Test worker contributions:
     *     - The first group of workers contributes, triggering the reveal phase.
     *     - The task is reopened after the reveal deadline is reached.
     *     - Ensure that workers who already contributed cannot contribute again.
     *     - The second group of workers contributes and reveals successfully.
     * - Finalize the task, distributing rewards among workers and the scheduler.
     * - Validate token balance changes for all participants.
     * - Verify that winning workers receive a positive score, while losing workers do not.
     */
    it(`[1] Task lifecycle with contributions and reopening`, async function () {
        const volume = 1n;
        const workers = [worker1, worker2, worker3, worker4];
        const firstContributors = workers.slice(0, 2);
        const secondContributors = workers.slice(2, 4);
        const accounts = [requester, scheduler, appProvider, datasetProvider, ...workers];

        // Create deal.
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
        const accountsInitialFrozens = await iexecWrapper.getInitialFrozens(accounts);

        for (const worker of workers) {
            expect(await iexecPoco.viewScore(worker.address)).to.be.equal(0);
        }
        const taskId = await iexecWrapper.initializeTask(dealId, 0n);
        const workerStakePerTask = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake);
        for (const contributor of firstContributors) {
            await iexecWrapper.contributeToTask(dealId, 0n, resultDigest, contributor);
        }
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        // Time travel post reveal deadline and reopen task.
        await setNextBlockTimestamp(task.revealDeadline).then(() => mine());
        await expect(iexecPocoAsScheduler.reopen(taskId))
            .to.emit(iexecPoco, 'TaskReopen')
            .withArgs(taskId);
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.ACTIVE);
        // Check that the already contributed workers can't contribute anymore
        for (const contributor of firstContributors) {
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                contributor,
            );
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                contributor.address,
                taskId,
                ZeroAddress,
                scheduler,
            );
            await iexecWrapper.depositInIexecAccount(contributor, workerStakePerTask); // Not a balance related revert.
            await expect(
                iexecPoco
                    .connect(contributor)
                    .contribute(
                        taskId,
                        resultHash,
                        resultSeal,
                        ZeroAddress,
                        '0x',
                        schedulerSignature,
                    ),
            ).to.revertedWithoutReason();
        }
        // Contribute and reveal with new workers.
        for (const contributor of secondContributors) {
            await iexecWrapper.contributeToTask(dealId, 0n, resultDigest, contributor);
        }
        for (const contributor of secondContributors) {
            await iexecPoco
                .connect(contributor)
                .reveal(taskId, resultDigest)
                .then((tx) => tx.wait());
        }
        const finalizeTx = await iexecPocoAsScheduler.finalize(taskId, results, '0x');
        await finalizeTx.wait();
        // Bad workers lose their stake and add it to the pool price
        const totalWorkerPoolReward =
            workerpoolPrice + workerStakePerTask * BigInt(firstContributors.length);

        const workersRewardPerTask = await iexecWrapper.computeWorkersRewardForCurrentTask(
            totalWorkerPoolReward,
            dealId,
        );
        const expectedWinningWorkerBalanceChange =
            workerStakePerTask + workersRewardPerTask / BigInt(secondContributors.length);
        // compute expected scheduler reward for current task
        const schedulerRewardPerTask = totalWorkerPoolReward - workersRewardPerTask;

        const expectedProxyBalanceChange = -(
            dealPrice +
            workerStakePerTask * BigInt(workers.length) +
            schedulerStakePerTask
        );
        await expect(finalizeTx).to.changeTokenBalances(
            iexecPoco,
            [proxyAddress, ...accounts],
            [
                expectedProxyBalanceChange,
                0,
                schedulerStakePerTask + schedulerRewardPerTask,
                appPrice,
                datasetPrice,
                ...firstContributors.map(() => 0), // Workers
                ...secondContributors.map(() => expectedWinningWorkerBalanceChange), // Workers
            ],
        );
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);
        const expectedFrozenChanges = [
            -taskPrice,
            -schedulerStakePerTask,
            0n,
            0n,
            ...workers.map(() => 0n),
        ];
        await iexecWrapper.checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);

        // Check losing workers scores.
        for (const contributor of firstContributors) {
            expect(await iexecPoco.viewScore(contributor.address)).to.be.equal(0);
        }
        // Check winning workers scores.
        for (const contributor of secondContributors) {
            expect(await iexecPoco.viewScore(contributor.address)).to.be.equal(1);
        }
    });
});
