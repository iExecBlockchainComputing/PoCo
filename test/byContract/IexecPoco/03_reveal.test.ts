// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero, HashZero } from '@ethersproject/constants';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { NULL } from '../../../utils/constants';
import { IexecOrders, OrdersAssets, OrdersPrices, buildOrders } from '../../../utils/createOrders';
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

const volume = 1;
const standardDealTag = HashZero;
const { resultDigest } = buildUtf8ResultAndDigest('result');
const { resultDigest: badResultDigest } = buildUtf8ResultAndDigest('bad-result');
const emptyEnclaveAddress = AddressZero;
const emptyEnclaveSignature = NULL.SIGNATURE;

describe('IexecPoco2#reveal', () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsWorker]: IexecInterfaceNative[] = [];
    let iexecWrapper: IexecWrapper;
    let [
        anyone,
        scheduler,
        worker,
        worker1,
        worker2,
        worker3,
        worker4,
        requester,
    ]: SignerWithAddress[] = [];
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;
    let orders: IexecOrders;
    let [dealId, taskId]: string[] = [];
    let taskIndex: number;
    let [resultHash, resultSeal]: string[] = [];
    let schedulerSignature: string;

    beforeEach(async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ scheduler, worker, worker1, worker2, worker3, worker4, requester, anyone } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        const { appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets();
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsWorker = iexecPoco.connect(worker);
        const appPrice = 1000;
        const datasetPrice = 1_000_000;
        const workerpoolPrice = 1_000_000_000;
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
        ({ orders } = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            volume,
            trust: 1,
            tag: standardDealTag,
        }));
        ({ dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(orders));
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        await iexecWrapper.depositInIexecAccount(worker, workerTaskStake);
        ({ resultHash, resultSeal } = buildResultHashAndResultSeal(taskId, resultDigest, worker));
        schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker.address,
            taskId,
            emptyEnclaveAddress,
            scheduler,
        );
    }

    it('Should reveal task contribution', async () => {
        await iexecPocoAsWorker
            .contribute(
                taskId,
                resultHash,
                resultSeal,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                schedulerSignature,
            )
            .then((tx) => tx.wait());

        await expect(iexecPocoAsWorker.reveal(taskId, resultDigest))
            .to.emit(iexecPoco, 'TaskReveal')
            .withArgs(taskId, worker.address, resultDigest);
        const contribution = await iexecPoco.viewContribution(taskId, worker.address);
        expect(contribution.status).equal(ContributionStatusEnum.PROVED);
        const task = await iexecPoco.viewTask(taskId);
        expect(task.revealCounter).equal(1);
        expect(task.resultDigest).equal(resultDigest);
    });

    it('Should not reveal when task is not in revealing status', async () => {
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).equal(TaskStatusEnum.ACTIVE);

        await expect(iexecPocoAsWorker.reveal(taskId, resultDigest)).to.be.revertedWithoutReason(); // require#1
    });

    it('Should not reveal after deadline', async () => {
        await iexecPocoAsWorker
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
        expect(task.status).equal(TaskStatusEnum.REVEALING);
        await time.setNextBlockTimestamp(task.revealDeadline);
        // revealing task
        // but after deadline
        await expect(iexecPocoAsWorker.reveal(taskId, resultDigest)).to.be.revertedWithoutReason(); // require#2
    });

    it('Should not reveal when did not contribute', async () => {
        await iexecPocoAsWorker
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
        expect(task.status).equal(TaskStatusEnum.REVEALING);
        const contribution = await iexecPoco.viewContribution(taskId, worker2.address);
        expect(contribution.status).equal(ContributionStatusEnum.UNSET);
        // revealing task, before deadline
        // but worker2 did not contribute before revealing
        await expect(
            iexecPoco.connect(worker2).reveal(taskId, resultDigest),
        ).to.be.revertedWithoutReason(); // require#3
    });

    it('Should not reveal twice', async () => {
        await iexecPocoAsWorker
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
        expect(task.status).equal(TaskStatusEnum.REVEALING);
        await iexecPocoAsWorker.reveal(taskId, resultDigest).then((tx) => tx.wait());
        const contribution = await iexecPoco.viewContribution(taskId, worker.address);
        expect(contribution.status).equal(ContributionStatusEnum.PROVED);
        // revealing task, before deadline
        // but contribution status not contributed anymore (since already proved)
        await expect(iexecPocoAsWorker.reveal(taskId, resultDigest)).to.be.revertedWithoutReason(); // require#3
    });

    it('Should not reveal when outside consensus', async () => {
        const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
            buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
                trust: 3,
                tag: standardDealTag,
                salt: ethers.utils.hexZeroPad('0x' + Date.now().toString(), 32), // make
            }).orders, // app and dataset orders unique since already matched in
            // beforeEach. A useless salt is also added to workerpool and request
            // orders to get an easy one-liner declaration.
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        const workers = [
            { signer: worker1, resultDigest: resultDigest },
            { signer: worker2, resultDigest: badResultDigest },
            { signer: worker3, resultDigest: resultDigest },
            { signer: worker4, resultDigest: resultDigest },
        ];
        const loosingWorker = worker2;
        // winning workers are worker1, worker3 & worker4
        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];
            const workerAddress = worker.signer.address;
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                worker.resultDigest,
                worker.signer,
            );
            await iexecWrapper.depositInIexecAccount(worker.signer, workerTaskStake);
            await iexecPoco
                .connect(worker.signer)
                .contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    await buildAndSignContributionAuthorizationMessage(
                        workerAddress,
                        taskId,
                        emptyEnclaveAddress,
                        scheduler,
                    ),
                )
                .then((tx) => tx.wait());
        }
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).equal(TaskStatusEnum.REVEALING);
        const contribution = await iexecPoco.viewContribution(taskId, loosingWorker.address);
        expect(contribution.status).equal(ContributionStatusEnum.CONTRIBUTED);
        expect(contribution.resultHash).not.equal(task.consensusValue);
        // revealing task, before deadline, contribution status is contributed
        // but contribution outside consensus
        await expect(
            iexecPoco.connect(loosingWorker).reveal(taskId, resultDigest),
        ).to.be.revertedWithoutReason(); // require#4
    });

    it('Should not reveal when unable to prove result value', async () => {
        await iexecPocoAsWorker
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
        expect(task.status).equal(TaskStatusEnum.REVEALING);
        const contribution = await iexecPoco.viewContribution(taskId, worker.address);
        expect(contribution.status).equal(ContributionStatusEnum.CONTRIBUTED);
        expect(contribution.resultHash).equal(task.consensusValue);
        expect(contribution.resultHash).not.equal(buildResultHash(taskId, badResultDigest));
        // revealing task, before deadline, contribution status is contributed
        // contribution is part of the consensus
        // but unable to prove result value
        await expect(
            iexecPocoAsWorker.reveal(taskId, badResultDigest),
        ).to.be.revertedWithoutReason(); // require#5
    });

    it('Should not reveal when unable to prove result ownership', async () => {
        await iexecPocoAsWorker
            .contribute(
                taskId,
                resultHash,
                // stolen result seal from another worker
                buildResultHashAndResultSeal(taskId, resultDigest, worker2).resultSeal,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                schedulerSignature,
            )
            .then((tx) => tx.wait());
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).equal(TaskStatusEnum.REVEALING);
        const contribution = await iexecPoco.viewContribution(taskId, worker.address);
        expect(contribution.status).equal(ContributionStatusEnum.CONTRIBUTED);
        expect(contribution.resultHash).equal(task.consensusValue);
        expect(contribution.resultHash).equal(buildResultHash(taskId, resultDigest));
        expect(contribution.resultSeal).not.equal(
            buildResultHashAndResultSeal(taskId, resultDigest, worker).resultSeal,
        );
        // revealing task, before deadline, contribution status is contributed
        // contribution is part of the consensus, result proof is valid
        // but unable to prove result ownership
        await expect(iexecPocoAsWorker.reveal(taskId, resultDigest)).to.be.revertedWithoutReason(); // require#6
    });
});
