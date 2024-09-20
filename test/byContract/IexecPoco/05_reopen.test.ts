// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero, HashZero } from '@ethersproject/constants';
import { loadFixture, mine, time } from '@nomicfoundation/hardhat-network-helpers';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { OrdersAssets, OrdersPrices, buildOrders } from '../../../utils/createOrders';
import {
    ContributionStatusEnum,
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildResultHash,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
} from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const resultDigest = buildUtf8ResultAndDigest('result').resultDigest;

describe('IexecPoco2#reopen', async () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsScheduler, iexecPocoAsWorker]: IexecInterfaceNative[] = [];
    let iexecWrapper: IexecWrapper;
    let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
    let [
        requester,
        scheduler,
        worker,
        worker1,
        worker2,
        worker3,
        worker4,
        anyone,
    ]: SignerWithAddress[] = [];
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;
    let [dealId, taskId]: string[] = [];
    let taskIndex: number;

    beforeEach('Deploy, match orders, and contribute', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ requester, scheduler, worker, worker1, worker2, worker3, worker4, anyone } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsScheduler = iexecPoco.connect(scheduler);
        iexecPocoAsWorker = iexecPoco.connect(worker);
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

    it('Should reopen task after reveal deadline', async () => {
        await matchOrdersAndInitializeTask(3); // Multiple workers.
        const resultHash = buildResultHash(taskId, resultDigest);
        const badResultDigest = buildUtf8ResultAndDigest('bad-result').resultDigest;
        const contributions = [
            { signer: worker1, resultDigest: resultDigest },
            { signer: worker2, resultDigest: badResultDigest },
            { signer: worker3, resultDigest: resultDigest },
            { signer: worker4, resultDigest: resultDigest },
        ];
        const winningWorkers = [worker1, worker3, worker4];
        const losingWorkers = [worker2];
        for (const contribution of contributions) {
            await contribute(contribution.signer, contribution.resultDigest);
            const onchainContributionBefore = await iexecPoco.viewContribution(
                taskId,
                contribution.signer.address,
            );
            expect(onchainContributionBefore.status).to.equal(ContributionStatusEnum.CONTRIBUTED);
        }
        const taskBefore = await iexecPoco.viewTask(taskId);
        expect(taskBefore.status).to.equal(TaskStatusEnum.REVEALING);
        expect(taskBefore.consensusValue).to.equal(resultHash);
        expect(taskBefore.revealCounter).to.equal(0);
        expect(taskBefore.winnerCounter).to.equal(3);
        // Time travel beyond reveal deadline but before final deadline.
        await setNextBlockTimestamp(taskBefore.revealDeadline).then(() => mine());
        const latestBlockTimestamp = await time.latest();
        expect(taskBefore.status).to.equal(TaskStatusEnum.REVEALING); // require 1
        expect(latestBlockTimestamp).to.be.lessThan(taskBefore.finalDeadline); // require 2
        expect(latestBlockTimestamp).to.be.greaterThanOrEqual(taskBefore.revealDeadline); // require 3.1
        expect(taskBefore.revealCounter).to.equal(0); // require 3.2
        // Reopen
        await expect(iexecPocoAsScheduler.reopen(taskId))
            .to.emit(iexecPoco, 'TaskReopen')
            .withArgs(taskId);
        for (const worker of winningWorkers) {
            const onchainContributionAfter = await iexecPoco.viewContribution(
                taskId,
                worker.address,
            );
            expect(onchainContributionAfter.status).to.equal(ContributionStatusEnum.REJECTED);
        }
        for (const worker of losingWorkers) {
            const onchainContributionAfter = await iexecPoco.viewContribution(
                taskId,
                worker.address,
            );
            expect(onchainContributionAfter.status).to.equal(ContributionStatusEnum.CONTRIBUTED);
        }
        // No getter for m_consensus.
        const taskAfter = await iexecPoco.viewTask(taskId);
        expect(taskAfter.status).to.equal(TaskStatusEnum.ACTIVE);
        expect(taskAfter.consensusValue).to.equal(HashZero);
        expect(taskAfter.revealCounter).to.equal(0);
        expect(taskAfter.winnerCounter).to.equal(0);
    });

    it('Should not reopen task when sender is not the scheduler', async () => {
        await matchOrdersAndInitializeTask(1);
        await contribute(worker, resultDigest);
        const task = await iexecPoco.viewTask(taskId);
        // Time travel beyond reveal deadline but before final deadline.
        await setNextBlockTimestamp(task.revealDeadline).then(() => mine());
        const latestBlockTimestamp = await time.latest();
        expect(task.status).to.equal(TaskStatusEnum.REVEALING); // require 1
        expect(latestBlockTimestamp).to.be.lessThan(task.finalDeadline); // require 2
        expect(latestBlockTimestamp).to.be.greaterThanOrEqual(task.revealDeadline); // require 3.1
        expect(task.revealCounter).to.equal(0); // require 3.2
        await expect(iexecPoco.reopen(taskId)).to.revertedWithoutReason();
    });

    it('Should not reopen task when status is before revealing', async () => {
        await matchOrdersAndInitializeTask(3);
        // Only 1 contribution, consensus not reached yet.
        await contribute(worker1, resultDigest);
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.be.lessThan(TaskStatusEnum.REVEALING); // require 1 <--
        expect(await time.latest()).to.be.lessThan(task.finalDeadline); // require 2
        expect(task.revealCounter).to.equal(0); // require 3.2
        await expect(iexecPoco.reopen(taskId)).to.revertedWithoutReason();
    });

    it('Should not reopen task when status is after revealing', async () => {
        await matchOrdersAndInitializeTask(1);
        const { results, resultDigest } = buildUtf8ResultAndDigest('result');
        await contribute(worker, resultDigest);
        // Move task to the next status (COMPLETED).
        await iexecPocoAsWorker.reveal(taskId, resultDigest).then((tx) => tx.wait());
        await iexecPocoAsScheduler.finalize(taskId, results, '0x');
        const task = await iexecPoco.viewTask(taskId);
        // Time travel beyond reveal deadline but before final deadline.
        await setNextBlockTimestamp(task.revealDeadline).then(() => mine());
        const latestBlockTimestamp = await time.latest();
        expect(task.status).to.be.greaterThan(TaskStatusEnum.REVEALING); // require 1 <--
        expect(latestBlockTimestamp).to.be.lessThan(task.finalDeadline); // require 2
        expect(latestBlockTimestamp).to.be.greaterThanOrEqual(task.revealDeadline); // require 3.1
        await expect(iexecPoco.reopen(taskId)).to.revertedWithoutReason();
    });

    it('Should not reopen task after final deadline', async () => {
        await matchOrdersAndInitializeTask(1);
        await contribute(worker, resultDigest);
        const task = await iexecPoco.viewTask(taskId);
        // Time travel beyond final deadline.
        await setNextBlockTimestamp(task.finalDeadline).then(() => mine(2));
        const latestBlockTimestamp = await time.latest();
        expect(task.status).to.equal(TaskStatusEnum.REVEALING); // require 1
        expect(latestBlockTimestamp).to.be.greaterThan(task.finalDeadline); // require 2 <--
        expect(latestBlockTimestamp).to.be.greaterThan(task.revealDeadline); // require 3.1
        expect(task.revealCounter).to.equal(0); // require 3.2
        await expect(iexecPoco.reopen(taskId)).to.revertedWithoutReason();
    });

    it('Should not reopen task before reveal deadline', async () => {
        await matchOrdersAndInitializeTask(1);
        await contribute(worker, resultDigest);
        const task = await iexecPoco.viewTask(taskId);
        // No time travel.
        const latestBlockTimestamp = await time.latest();
        expect(task.status).to.equal(TaskStatusEnum.REVEALING); // require 1
        expect(latestBlockTimestamp).to.be.lessThan(task.finalDeadline); // require 2
        expect(latestBlockTimestamp).to.be.lessThan(task.revealDeadline); // require 3.1 <--
        expect(task.revealCounter).to.equal(0); // require 3.2
        await expect(iexecPoco.reopen(taskId)).to.revertedWithoutReason();
    });

    it('Should not reopen task with at least 1 reveal', async () => {
        await matchOrdersAndInitializeTask(3);
        await contribute(worker1, resultDigest);
        await contribute(worker2, resultDigest);
        // Consensus reached, reveal for worker 1.
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, resultDigest)
            .then((tx) => tx.wait());
        const task = await iexecPoco.viewTask(taskId);
        // Time travel beyond reveal deadline but before final deadline.
        await setNextBlockTimestamp(task.revealDeadline).then(() => mine());
        const latestBlockTimestamp = await time.latest();
        expect(task.status).to.equal(TaskStatusEnum.REVEALING); // require 1
        expect(latestBlockTimestamp).to.be.lessThan(task.finalDeadline); // require 2
        expect(latestBlockTimestamp).to.be.greaterThanOrEqual(task.revealDeadline); // require 3.1
        expect(task.revealCounter).to.be.greaterThan(0); // require 3.2 <--
        await expect(iexecPoco.reopen(taskId)).to.revertedWithoutReason();
    });

    /**
     * Create orders with the provided trust, match deal, and initialize task.
     * @param trust
     */
    async function matchOrdersAndInitializeTask(trust: number) {
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            trust,
        });
        ({ dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        ));
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
    }

    /**
     * Send contribution of the specified worker.
     * @param worker
     * @param resultDigest
     */
    async function contribute(worker: SignerWithAddress, resultDigest: string) {
        const emptyEnclaveAddress = AddressZero;
        const emptyEnclaveSignature = '0x';
        const workerTaskStake = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        await iexecWrapper.depositInIexecAccount(worker, workerTaskStake);
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
});
