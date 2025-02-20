// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { Wallet, ZeroAddress, ZeroHash, ethers } from 'ethers';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    TestClient__factory,
} from '../../../typechain';
import { OrdersAssets, OrdersPrices, buildOrders } from '../../../utils/createOrders';
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
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';
import { config } from '../../../config/config-utils';

const appPrice = 1000n;
const datasetPrice = 1_000_000n;
const workerpoolPrice = 1_000_000_000n;
const taskPrice = appPrice + datasetPrice + workerpoolPrice;
const timeRef = BigInt(config.categories[0].workClockTimeRef);
const trust = 1n;
const volume = 1n;
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const standardDealTag = ZeroHash;
const emptyEnclaveAddress = ZeroAddress;
const emptyEnclaveSignature = '0x';
const noCallbackData = '0x';
const noResultsData = '0x';
const { results, resultDigest } = buildUtf8ResultAndDigest('result');

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

// TODO add an integration test for contributeAndFinalize

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
        const appPrice = 1000n;
        const datasetPrice = 1_000_000n;
        const workerpoolPrice = 1_000_000_000n;
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

    it('Should contributeAndFinalize TEE task with broker, callback, and a single worker', async () => {
        await iexecWrapper.setTeeBroker(sms.address);
        const callbackConsumer = await new TestClient__factory()
            .connect(anyone)
            .deploy()
            .then((contract) => contract.waitForDeployment());
        const callbackConsumerAddress = await callbackConsumer.getAddress();
        // Create deal and task.
        const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
                trust,
                tag: teeDealTag,
                callback: callbackConsumerAddress,
            }).toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        // Save frozens.
        const accounts = [requester, appProvider, datasetProvider, scheduler, worker];
        const accountsInitialFrozens = await iexecWrapper.getInitialFrozens(accounts);
        // Run contributeAndFinalize.
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
                noResultsData,
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
        expect(task.revealDeadline).to.equal(contributeAndFinalizeBlockTimestamp + timeRef * 2n);
        expect(task.revealCounter).to.equal(1);
        expect(task.winnerCounter).to.equal(1);
        expect(task.resultDigest).to.equal(resultsCallbackDigest);
        expect(task.results).to.equal(noResultsData);
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
            0n, // App provider
            0n, // Dataset provider
            -schedulerStake, // Scheduler
            0n, // Worker
        ];
        await iexecWrapper.checkFrozenChanges(accountsInitialFrozens, expectedFrozenChanges);
        // Check events.
        await expect(contributeAndFinalizeTx)
            .to.emit(iexecPoco, 'Seize')
            .withArgs(requester.address, taskPrice, taskId)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(proxyAddress, appProvider.address, appPrice)
            .to.emit(iexecPoco, 'Reward')
            .withArgs(appProvider.address, appPrice, taskId)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(proxyAddress, datasetProvider.address, datasetPrice)
            .to.emit(iexecPoco, 'Reward')
            .withArgs(datasetProvider.address, datasetPrice, taskId)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(proxyAddress, scheduler.address, schedulerStake)
            .to.emit(iexecPoco, 'Unlock')
            .withArgs(scheduler.address, schedulerStake)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(proxyAddress, worker.address, workersReward)
            .to.emit(iexecPoco, 'Reward')
            .withArgs(worker.address, workersReward, taskId)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(proxyAddress, scheduler.address, schedulerReward)
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
            .withArgs(taskId, noResultsData);
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
        // Run contributeAndFinalize.
        const { resultHash } = buildResultHashAndResultSeal(taskId, resultDigest, worker);
        const contributeAndFinalizeTx = await iexecPoco
            .connect(worker)
            .contributeAndFinalize(
                taskId,
                resultDigest,
                results,
                noCallbackData,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                await buildAndSignContributionAuthorizationMessage(
                    worker.address,
                    taskId,
                    emptyEnclaveAddress,
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
        expect(task.results).to.equal(ethers.hexlify(results));
        expect(task.resultsCallback).to.equal(noCallbackData);
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
        // Create deal and task.
        const { taskId } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
                trust,
                tag: standardDealTag,
            }).toArray(),
        );
        // No initialize.
        await expect(
            iexecPoco
                .connect(worker)
                .contributeAndFinalize(
                    taskId,
                    resultDigest,
                    results,
                    noCallbackData,
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
        const task = await iexecPoco.viewTask(taskId);
        await time.setNextBlockTimestamp(task.contributionDeadline);
        // Task is active but after deadline.
        await expect(
            iexecPoco
                .connect(worker)
                .contributeAndFinalize(
                    taskId,
                    resultDigest,
                    results,
                    noCallbackData,
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
        // TODO require#3
    });

    it('Should not contributeAndFinalize when trust is > 1', async () => {
        const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
                trust: 3n,
                tag: standardDealTag,
            }).toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        // Task active, before deadline, but bad trust.
        await expect(
            iexecPoco
                .connect(worker)
                .contributeAndFinalize(
                    taskId,
                    resultDigest,
                    results,
                    noCallbackData,
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

    it('Should not contributeAndFinalize when result digest does not match callback data hash', async () => {
        // Create deal and task.
        const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
                trust,
                tag: standardDealTag,
                callback: Wallet.createRandom().address, // Using callback
            }).toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        // Task active, before deadline, good trust, but bad callback data.
        const { callbackResultDigest: resultsCallbackDigest } = buildResultCallbackAndDigest(123);
        await expect(
            iexecPoco.connect(worker).contributeAndFinalize(
                taskId,
                resultsCallbackDigest,
                noResultsData,
                ethers.hexlify(ethers.randomBytes(32)), // Bad callback data.
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                await buildAndSignContributionAuthorizationMessage(
                    worker.address,
                    taskId,
                    emptyEnclaveAddress,
                    scheduler,
                ),
            ),
        ).to.be.revertedWithoutReason(); // require#5
    });

    it('Should not contributeAndFinalize when enclave challenge is missing (TEE)', async () => {
        const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
                trust,
                tag: teeDealTag,
            }).toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        // Task active, before deadline, good trust, but missing enclave challenge.
        await expect(
            iexecPoco
                .connect(worker)
                .contributeAndFinalize(
                    taskId,
                    resultDigest,
                    results,
                    noCallbackData,
                    emptyEnclaveAddress,
                    emptyEnclaveSignature,
                    await buildAndSignContributionAuthorizationMessage(
                        worker.address,
                        taskId,
                        emptyEnclaveAddress,
                        scheduler,
                    ),
                ),
        ).to.be.revertedWithoutReason(); // require#6
    });

    it('Should not contributeAndFinalize when scheduler signature is invalid', async () => {
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
        // Task active, before deadline, good trust, but invalid scheduler signature.
        await expect(
            iexecPocoAsWorker.contributeAndFinalize(
                taskId,
                resultDigest,
                results,
                noCallbackData,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                '0xbadd', // Bad scheduler signature
            ),
        ).to.be.revertedWith('invalid-signature-format'); // require#7
    });

    it('Should not contributeAndFinalize when authorization is not signed by TEE broker', async () => {
        await iexecWrapper.setTeeBroker(sms.address);
        const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
                trust,
                tag: teeDealTag,
            }).toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            resultDigest,
            worker,
        );
        // Task active, before deadline, good trust, good signature, but not signed by TEE broker.
        await expect(
            iexecPocoAsWorker.contributeAndFinalize(
                taskId,
                resultDigest,
                results,
                noCallbackData,
                enclave.address,
                await buildAndSignPocoClassicEnclaveMessage(resultHash, resultSeal, enclave),
                await buildAndSignContributionAuthorizationMessage(
                    worker.address,
                    taskId,
                    enclave.address,
                    scheduler, // Signed by schedule when it must be signed by the sms.
                ),
            ),
        ).to.be.revertedWithoutReason(); // require#7
    });

    it('Should not contributeAndFinalize when enclave signature is invalid (TEE)', async () => {
        const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume,
                trust,
                tag: teeDealTag,
            }).toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        // Task active, before deadline, good trust, good enclave challenge, but invalid enclave signature.
        await expect(
            iexecPocoAsWorker.contributeAndFinalize(
                taskId,
                resultDigest,
                results,
                noCallbackData,
                enclave.address,
                '0xbadd', // Bad enclave signature
                await buildAndSignContributionAuthorizationMessage(
                    worker.address,
                    taskId,
                    enclave.address,
                    scheduler,
                ),
            ),
        ).to.be.revertedWith('invalid-signature-format'); // require#8
    });
});
