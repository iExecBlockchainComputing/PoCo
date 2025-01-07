// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero, HashZero } from '@ethersproject/constants';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    TestClient__factory,
} from '../../../typechain';
import { NULL } from '../../../utils/constants';
import { IexecOrders, OrdersAssets, OrdersPrices, buildOrders } from '../../../utils/createOrders';
import {
    ContributionStatusEnum,
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildAndSignPocoClassicEnclaveMessage,
    buildResultCallbackAndDigest,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
    setNextBlockTimestamp,
} from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';
const CONFIG = require('../../../config/config.json');

const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const taskPrice = appPrice + datasetPrice + workerpoolPrice;
const timeRef = CONFIG.categories[0].workClockTimeRef;
const trust = 1;
const volume = 1;
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const standardDealTag = HashZero;
const emptyEnclaveAddress = AddressZero;
const emptyEnclaveSignature = NULL.SIGNATURE;

let proxyAddress: string;
let [iexecPoco, iexecPocoAsWorker]: IexecInterfaceNative[] = [];
let iexecWrapper: IexecWrapper;
let [
    requester,
    appProvider,
    datasetProvider,
    scheduler,
    sms,
    enclave,
    worker,
    anyone,
]: SignerWithAddress[] = [];
let ordersAssets: OrdersAssets;
let ordersPrices: OrdersPrices;
let defaultOrders: IexecOrders;

describe('IexecPoco2#contributeAndFinalize', () => {
    beforeEach(async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ requester, appProvider, datasetProvider, scheduler, sms, enclave, worker, anyone } =
            accounts);
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
        defaultOrders = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            volume,
            trust: 1,
            tag: standardDealTag,
        });
    }

    describe('ContributeAndFinalize', () => {
        it('Should contributeAndFinalize TEE task with broker, callback, and a single worker', async () => {
            await iexecWrapper.setTeeBroker(sms.address);
            const callbackConsumer = await new TestClient__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.deployed());
            // Create deal and task.
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                    trust,
                    tag: teeDealTag,
                    callback: callbackConsumer.address,
                }).toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            // Save frozens.
            const accounts = [requester, appProvider, datasetProvider, scheduler, worker];
            const accountsInitialFrozens = await iexecWrapper.getInitialFrozens(accounts);
            // ContributeAndFinalize task.
            const { resultsCallback, callbackResultDigest: resultsCallbackDigest } =
                buildResultCallbackAndDigest(123);
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultsCallbackDigest,
                worker,
            );
            const contributeAndFinalizeBlockTimestamp = await setNextBlockTimestamp();
            const contributeAndFinalizeTx = await iexecPoco
                .connect(worker)
                .contributeAndFinalize(
                    taskId,
                    resultsCallbackDigest,
                    '0x',
                    resultsCallback,
                    enclave.address,
                    await buildAndSignPocoClassicEnclaveMessage(resultHash, resultSeal, enclave),
                    await buildAndSignContributionAuthorizationMessage(
                        worker.address,
                        taskId,
                        enclave.address,
                        sms,
                    ),
                );
            await contributeAndFinalizeTx.wait();
            // Check state.
            const deal = await iexecPoco.viewDeal(dealId);
            expect(deal.tag).to.equal(teeDealTag);
            const contribution = await iexecPoco.viewContribution(taskId, worker.address);
            expect(contribution.status).to.equal(ContributionStatusEnum.PROVED);
            expect(contribution.resultHash).to.equal(resultHash);
            expect(contribution.resultSeal).to.equal(resultSeal);
            expect(contribution.enclaveChallenge).to.equal(enclave.address);
            expect(contribution.weight).to.equal(0);
            const task = await iexecPoco.viewTask(taskId);
            expect(task.status).to.equal(TaskStatusEnum.COMPLETED);
            expect(task.consensusValue).to.equal(resultHash);
            expect(task.revealDeadline).to.equal(contributeAndFinalizeBlockTimestamp + timeRef * 2);
            expect(task.revealCounter).to.equal(1);
            expect(task.winnerCounter).to.equal(1);
            expect(task.resultDigest).to.equal(resultsCallbackDigest);
            expect(task.results).to.equal('0x');
            expect(task.resultsCallback).to.equal(resultsCallback);
            expect(task.contributors.length).to.equal(1);
            expect(task.contributors[0]).to.equal(worker.address);
            // Check balance changes.
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume, // 1 => schedulerTaskStake == schedulerDealStake.
            );
            const workersReward = await iexecWrapper.computeWorkersRewardForCurrentTask(
                workerpoolPrice,
                dealId,
            );
            const schedulerReward = workerpoolPrice - workersReward;
            await expect(contributeAndFinalizeTx).to.changeTokenBalances(
                iexecPoco,
                [iexecPoco, requester, appProvider, datasetProvider, scheduler, worker],
                [
                    -(appPrice + datasetPrice + workerpoolPrice + schedulerStake), // Proxy (reward, unlock)
                    0, // Requester is seized
                    appPrice, // App provider is rewarded
                    datasetPrice, // Dataset provider is rewarded
                    schedulerStake + // Scheduler stake is unlocked
                        schedulerReward, // Scheduler is rewarded
                    workersReward, // Worker is rewarded
                ],
            );
            // Check frozen changes.
            const expectedFrozenChanges = [
                -taskPrice, // Requester (dealPrice)
                0, // App provider
                0, // Dataset provider
                -schedulerStake, // Scheduler
                0, // Worker
            ];
            await iexecWrapper.checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
            // Check events.
            await expect(contributeAndFinalizeTx)
                .to.emit(iexecPoco, 'Seize')
                .withArgs(requester.address, taskPrice, taskId)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, appProvider.address, appPrice)
                .to.emit(iexecPoco, 'Reward')
                .withArgs(appProvider.address, appPrice, taskId)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, datasetProvider.address, datasetPrice)
                .to.emit(iexecPoco, 'Reward')
                .withArgs(datasetProvider.address, datasetPrice, taskId)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, scheduler.address, schedulerStake)
                .to.emit(iexecPoco, 'Unlock')
                .withArgs(scheduler.address, schedulerStake)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, worker.address, workersReward)
                .to.emit(iexecPoco, 'Reward')
                .withArgs(worker.address, workersReward, taskId)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, scheduler.address, schedulerReward)
                .to.emit(iexecPoco, 'Reward')
                .withArgs(scheduler.address, schedulerReward, taskId);
            // Task events.
            await expect(contributeAndFinalizeTx)
                .to.emit(iexecPoco, 'TaskContribute')
                .withArgs(taskId, worker.address, resultHash)
                .to.emit(iexecPoco, 'TaskConsensus')
                .withArgs(taskId, resultHash)
                .to.emit(iexecPoco, 'TaskReveal')
                .withArgs(taskId, worker.address, resultsCallbackDigest)
                .to.emit(iexecPoco, 'TaskFinalize')
                .withArgs(taskId, '0x');
            // Callback events.
            await expect(contributeAndFinalizeTx)
                .to.emit(callbackConsumer, 'GotResult')
                .withArgs(taskId, resultsCallback);
        });

        it('Should contributeAndFinalize standard task with a single worker', async () => {
            // Create deal and task.
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                    trust,
                    tag: standardDealTag,
                }).toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            // ContributeAndFinalize task.
            const { results, resultDigest } = buildUtf8ResultAndDigest('result');
            const { resultHash } = buildResultHashAndResultSeal(taskId, resultDigest, worker);
            const contributeAndFinalizeTx = await iexecPoco.connect(worker).contributeAndFinalize(
                taskId,
                resultDigest,
                results,
                '0x',
                AddressZero, // enclave,
                '0x',
                await buildAndSignContributionAuthorizationMessage(
                    worker.address,
                    taskId,
                    AddressZero, // enclave
                    scheduler,
                ),
            );
            await contributeAndFinalizeTx.wait();
            // Check relevant state.
            const deal = await iexecPoco.viewDeal(dealId);
            expect(deal.tag).to.equal(standardDealTag);
            const task = await iexecPoco.viewTask(taskId);
            expect(task.status).to.equal(TaskStatusEnum.COMPLETED);
            expect(task.resultDigest).to.equal(resultDigest);
            expect(task.results).to.equal(ethers.utils.hexlify(results));
            expect(task.resultsCallback).to.equal('0x');
            // Check events.
            await expect(contributeAndFinalizeTx)
                .to.emit(iexecPoco, 'TaskContribute')
                .withArgs(taskId, worker.address, resultHash)
                .to.emit(iexecPoco, 'TaskConsensus')
                .withArgs(taskId, resultHash)
                .to.emit(iexecPoco, 'TaskReveal')
                .withArgs(taskId, worker.address, resultDigest)
                .to.emit(iexecPoco, 'TaskFinalize')
                .withArgs(taskId, results);
        });

        it('Should not contributeAndFinalize when task is not active', async () => {
            const { taskId } = await iexecWrapper.signAndMatchOrders(...defaultOrders.toArray());
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker,
            );
            await expect(
                iexecPocoAsWorker.contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    await buildAndSignContributionAuthorizationMessage(
                        worker.address,
                        taskId,
                        emptyEnclaveAddress,
                        scheduler,
                    ),
                ),
            ).to.be.revertedWithoutReason(); // require#1
        });

        it('Should not contributeAndFinalize after deadline', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...defaultOrders.toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.ACTIVE);
            const task = await iexecPoco.viewTask(taskId);
            await time.setNextBlockTimestamp(task.contributionDeadline);
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker,
            );
            // active task
            // but after deadline
            await expect(
                iexecPocoAsWorker.contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    await buildAndSignContributionAuthorizationMessage(
                        worker.address,
                        taskId,
                        emptyEnclaveAddress,
                        scheduler,
                    ),
                ),
            ).to.be.revertedWithoutReason(); // require#2
        });

        it('Should not contributeAndFinalize when someone else has already contributed', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                    trust: 3, // so consensus is not yet reached on first contribution
                    tag: standardDealTag,
                }).toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const workerTaskStake = await iexecPoco
                .viewDeal(dealId)
                .then((deal) => deal.workerStake.toNumber());
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker,
            );
            await iexecWrapper.depositInIexecAccount(worker, workerTaskStake);
            await iexecPocoAsWorker
                .contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    await buildAndSignContributionAuthorizationMessage(
                        worker.address,
                        taskId,
                        emptyEnclaveAddress,
                        scheduler,
                    ),
                )
                .then((tx) => tx.wait());
            expect((await iexecPoco.viewContribution(taskId, worker.address)).status).to.equal(
                ContributionStatusEnum.CONTRIBUTED,
            );
            // active task, before deadline
            // but already contributed
            await expect(
                iexecPocoAsWorker.contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    await buildAndSignContributionAuthorizationMessage(
                        worker.address,
                        taskId,
                        emptyEnclaveAddress,
                        scheduler,
                    ),
                ),
            ).to.be.revertedWithoutReason(); // require#3
        });

        it('Should not contributeAndFinalize when trust != 1', async () => {
            // trust == 0
            // trust > 1
        });

        it('Should not contributeAndFinalize when callback data is missing', async () => {});

        it('Should not contributeAndFinalize when enclave challenge for TEE task is missing', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                    trust: 0,
                    tag: teeDealTag,
                }).toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker,
            );
            // active task, before deadline, not contributed
            // but no TEE enclave challenge
            await expect(
                iexecPocoAsWorker.contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    await buildAndSignContributionAuthorizationMessage(
                        worker.address,
                        taskId,
                        emptyEnclaveAddress,
                        scheduler,
                    ),
                ),
            ).to.be.revertedWithoutReason(); // require#4
        });

        it('Should not contributeAndFinalize when scheduler signature is invalid', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...defaultOrders.toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker,
            );
            // active task, before deadline, not contributed, enclave challenge not required
            // but invalid scheduler signature
            await expect(
                iexecPocoAsWorker.contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    await buildAndSignContributionAuthorizationMessage(
                        worker.address,
                        taskId,
                        emptyEnclaveAddress,
                        anyone, // authorization not signed by scheduler
                    ),
                ),
            ).to.be.revertedWithoutReason(); // require#5
        });

        it('Should not contributeAndFinalize when enclave signature is invalid', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                    trust: 0,
                    tag: teeDealTag,
                }).toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker,
            );
            // active task, before deadline, not contributed, enclave challenge set,
            // valid scheduler signature
            // but invalid enclave signature
            await expect(
                iexecPocoAsWorker.contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    enclave.address,
                    await buildAndSignPocoClassicEnclaveMessage(
                        resultHash,
                        resultSeal,
                        anyone, // enclave message signed by someone else
                    ),
                    await buildAndSignContributionAuthorizationMessage(
                        worker.address,
                        taskId,
                        enclave.address,
                        scheduler,
                    ),
                ),
            ).to.be.revertedWithoutReason(); // require#6
        });
    });
});
