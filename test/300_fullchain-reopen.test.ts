// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

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
    buildAndSignPocoClassicEnclaveMessage,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
} from '../utils/poco-tools';
import { IexecWrapper } from './utils/IexecWrapper';

const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';

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
    enclave,
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
            enclave,
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

    it(`[1] `, async function () {
        const volume = 1;
        const workers = [worker1, worker2, worker3, worker4];
        const firstContribution = workers.slice(0, 2);
        const secondContribution = workers.slice(2, 4);
        const accounts = [requester, scheduler, appProvider, datasetProvider, ...workers];

        // Create deal.
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: teeDealTag,
            volume,
            trust: 4,
        });
        const { dealId, dealPrice, schedulerStakePerDeal } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        const taskPrice = appPrice + datasetPrice + workerpoolPrice;
        const schedulerStakePerTask = schedulerStakePerDeal / volume;
        const accountsInitialFrozens = await iexecWrapper.getInitialFrozens(accounts);

        for (let i = 0; i < 4; i++) {
            expect(await iexecPoco.viewScore(workers[i].address)).to.be.equal(0);
        }
        const taskId = await iexecWrapper.initializeTask(dealId, 0);
        const workerStakePerTask = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        for (const contributor of firstContribution) {
            await iexecWrapper.contributeToTeeTask(dealId, 0, resultDigest, contributor);
        }
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        await setNextBlockTimestamp(task.revealDeadline).then(() => mine());
        await expect(iexecPocoAsScheduler.reopen(taskId))
            .to.emit(iexecPoco, 'TaskReopen')
            .withArgs(taskId);
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.ACTIVE);
        // test that the already contributed worker 1 can't contribute anymore
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            resultDigest,
            worker1,
        );
        const enclaveAddress = enclave.address;
        const enclaveSignature = await buildAndSignPocoClassicEnclaveMessage(
            resultHash,
            resultSeal,
            enclave,
        );
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker1.address,
            taskId,
            enclaveAddress,
            scheduler,
        );
        await expect(
            iexecPoco
                .connect(worker1)
                .contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    enclaveAddress,
                    enclaveSignature,
                    schedulerSignature,
                ),
        ).to.revertedWithoutReason();

        for (const contributor of secondContribution) {
            await iexecWrapper.contributeToTeeTask(dealId, 0, resultDigest, contributor);
        }
        for (const contributor of secondContribution) {
            await iexecPoco
                .connect(contributor)
                .reveal(taskId, resultDigest)
                .then((tx) => tx.wait());
        }
        const finalizeTx = await iexecPocoAsScheduler.finalize(taskId, results, '0x');
        await finalizeTx.wait();
        const totalWorkerPoolReward =
            workerpoolPrice + workerStakePerTask * firstContribution.length; // bad wrokers lose their stake and add it to the pool price

        const workersRewardPerTask = await iexecWrapper.computeWorkersRewardForCurrentTask(
            totalWorkerPoolReward,
            dealId,
        );
        const expectedWinningWorkerBalanceChange =
            workerStakePerTask + workersRewardPerTask / secondContribution.length;
        // compute expected scheduler reward for current task
        const schedulerRewardPerTask = totalWorkerPoolReward - workersRewardPerTask;
        const expectedSchedulerBalanceChange = schedulerStakePerTask + schedulerRewardPerTask;

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
                expectedSchedulerBalanceChange,
                appPrice,
                datasetPrice,
                ...firstContribution.map(() => 0), // Workers
                ...secondContribution.map(() => expectedWinningWorkerBalanceChange), // Workers
            ],
        );
        expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.COMPLETED);
        const expectedFrozenChanges = [
            0,
            -taskPrice,
            -schedulerStakePerTask,
            0,
            0,
            ...workers.map(() => 0),
        ];
        await iexecWrapper.checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);

        // checks on losing worker
        for (const contributor of firstContribution) {
            expect(await iexecPoco.viewScore(contributor.address)).to.be.equal(0);
        }
        // checks on winning workers
        for (const contributor of secondContribution) {
            expect(await iexecPoco.viewScore(contributor.address)).to.be.equal(1);
        }
    });
});
