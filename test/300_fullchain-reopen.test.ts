// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../typechain';
import { OrdersActors, OrdersAssets, OrdersPrices, buildOrders } from '../utils/createOrders';

import {
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
} from '../utils/poco-tools';
import { IexecWrapper } from './utils/IexecWrapper';

const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
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
        const volume = 1;
        const workers = [worker1, worker2, worker3, worker4];
        const firstContributors = workers.slice(0, 2);
        const secondContributors = workers.slice(2, 4);
        const accounts = [requester, scheduler, appProvider, datasetProvider, ...workers];

        // Create deal.
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
        const accountsInitialFrozens = await iexecWrapper.getInitialFrozens(accounts);

        for (const worker of workers) {
            expect(await iexecPoco.viewScore(worker.address)).to.be.equal(0);
        }
        const taskId = await iexecWrapper.initializeTask(dealId, 0);
        const workerStakePerTask = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        for (const contributor of firstContributors) {
            await iexecWrapper.contributeToTask(dealId, 0, resultDigest, contributor);
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
                AddressZero,
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
                        AddressZero,
                        '0x',
                        schedulerSignature,
                    ),
            ).to.revertedWithoutReason();
        }
        // Contribute and reveal with new workers.
        for (const contributor of secondContributors) {
            await iexecWrapper.contributeToTask(dealId, 0, resultDigest, contributor);
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
            workerpoolPrice + workerStakePerTask * firstContributors.length;

        const workersRewardPerTask = await iexecWrapper.computeWorkersRewardForCurrentTask(
            totalWorkerPoolReward,
            dealId,
        );
        const expectedWinningWorkerBalanceChange =
            workerStakePerTask + workersRewardPerTask / secondContributors.length;
        // compute expected scheduler reward for current task
        const schedulerRewardPerTask = totalWorkerPoolReward - workersRewardPerTask;

        const expectedProxyBalanceChange = -(
            dealPrice +
            workerStakePerTask * workers.length +
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
            0,
            0,
            ...workers.map(() => 0),
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
