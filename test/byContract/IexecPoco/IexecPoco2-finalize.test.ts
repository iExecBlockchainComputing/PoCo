// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, setStorageAt, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { AbiCoder, Wallet, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    OwnableMock__factory,
    TestClient__factory,
} from '../../../typechain';
import { OrdersAssets, OrdersPrices, buildOrders } from '../../../utils/createOrders';
import {
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildResultCallbackAndDigest,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
} from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';

const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const hexResults = ethers.hexlify(results);
const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);

const appPrice = 1000n;
const datasetPrice = 1_000_000n;
const workerpoolPrice = 1_000_000_000n;
const taskPrice = appPrice + datasetPrice + workerpoolPrice;
const emptyEnclaveAddress = ZeroAddress;
const emptyEnclaveSignature = '0x';

describe('IexecPoco2#finalize', async () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsScheduler]: IexecInterfaceNative[] = [];
    let iexecWrapper: IexecWrapper;
    let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
    let [
        requester,
        sponsor,
        appProvider,
        datasetProvider,
        scheduler,
        worker1,
        worker2,
        worker3,
        worker4,
        anyone,
    ]: SignerWithAddress[] = [];
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;

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
            appProvider,
            datasetProvider,
            scheduler,
            worker1,
            worker2,
            worker3,
            worker4,
            anyone,
        } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        await iexecWrapper.setTeeBroker('0x0000000000000000000000000000000000000000');
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsScheduler = iexecPoco.connect(scheduler);
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
    it('Should finalize task of deal payed by sponsor (with callback)', async () => {
        const oracleConsumerInstance = await new TestClient__factory()
            .connect(anyone)
            .deploy()
            .then((contract) => contract.waitForDeployment());
        const expectedVolume = 3n; // > 1 to explicit taskPrice vs dealPrice
        const orders = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            volume: expectedVolume,
            trust: 3n,
            callback: await oracleConsumerInstance.getAddress(),
        });
        const { dealId, taskId, taskIndex, dealPrice } =
            await iexecWrapper.signAndSponsorMatchOrders(...orders.toArray());
        const schedulerDealStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            expectedVolume,
        );
        const schedulerTaskStake = schedulerDealStake / expectedVolume;
        const kittyAddress = await iexecPoco.kitty_address();
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco.viewDeal(dealId).then((deal) => deal.workerStake);
        const { callbackResultDigest: wrongCallbackResultDigest } =
            buildResultCallbackAndDigest(567);
        const workers = [
            { signer: worker1, callbackResultDigest: callbackResultDigest },
            { signer: worker2, callbackResultDigest: wrongCallbackResultDigest },
            { signer: worker3, callbackResultDigest: callbackResultDigest },
            { signer: worker4, callbackResultDigest: callbackResultDigest },
        ];
        const winningWorkers = [worker1, worker3, worker4];
        const losingWorker = worker2;
        // Set same non-zero score to each worker.
        // Each winning worker should win 1 workerScore point.
        // Losing worker should loose at least 33% of its workerScore (here
        // it will loose 1 point since score is an integer).
        for (const worker of workers) {
            await setWorkerScoreInStorage(worker.signer.address, 1);
        }
        for (const worker of workers) {
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                worker.callbackResultDigest,
                worker.signer,
            );
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.signer.address,
                taskId,
                emptyEnclaveAddress,
                scheduler,
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
                    schedulerSignature,
                )
                .then((tx) => tx.wait());
        }
        for (const worker of winningWorkers) {
            await iexecPoco
                .connect(worker)
                .reveal(taskId, callbackResultDigest)
                .then((tx) => tx.wait());
        }
        const requesterFrozenBefore = await iexecPoco.frozenOf(requester.address);
        const sponsorFrozenBefore = await iexecPoco.frozenOf(sponsor.address);
        const schedulerFrozenBefore = await iexecPoco.frozenOf(scheduler.address);
        const workersFrozenBefore: { [name: string]: bigint } = {};
        for (const worker of workers) {
            const workerAddress = worker.signer.address;
            workersFrozenBefore[workerAddress] = await iexecPoco
                .frozenOf(workerAddress)
                .then((frozen) => frozen);
            expect(await iexecPoco.viewScore(workerAddress)).to.be.equal(1);
        }
        const kittyFrozenBefore = await iexecPoco.frozenOf(kittyAddress);
        const taskBefore = await iexecPoco.viewTask(taskId);
        expect(taskBefore.status).to.equal(TaskStatusEnum.REVEALING);
        expect(taskBefore.revealCounter).to.equal(taskBefore.winnerCounter);

        const finalizeTx = await iexecPocoAsScheduler.finalize(taskId, results, resultsCallback);
        await finalizeTx.wait();
        await expect(finalizeTx)
            .to.emit(iexecPoco, 'Seize')
            .withArgs(sponsor.address, taskPrice, taskId)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(proxyAddress, appProvider.address, appPrice)
            .to.emit(iexecPoco, 'Reward')
            .withArgs(appProvider.address, appPrice, taskId)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(proxyAddress, datasetProvider.address, datasetPrice)
            .to.emit(iexecPoco, 'Reward')
            .withArgs(datasetProvider.address, datasetPrice, taskId)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(proxyAddress, scheduler.address, schedulerTaskStake)
            .to.emit(iexecPoco, 'Unlock')
            .withArgs(scheduler.address, schedulerTaskStake);
        const workerReward = 429000000n;
        for (const worker of winningWorkers) {
            await expect(finalizeTx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(proxyAddress, worker.address, workerTaskStake)
                .to.emit(iexecPoco, 'Unlock')
                .withArgs(worker.address, workerTaskStake)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(proxyAddress, worker.address, workerReward)
                .to.emit(iexecPoco, 'Reward')
                .withArgs(worker.address, workerReward, taskId)
                .to.emit(iexecPoco, 'AccurateContribution')
                .withArgs(worker.address, taskId);
        }
        await expect(finalizeTx)
            .to.emit(iexecPoco, 'Seize')
            .withArgs(losingWorker.address, workerTaskStake, taskId)
            .to.emit(iexecPoco, 'FaultyContribution')
            .withArgs(losingWorker.address, taskId);
        const schedulerReward =
            workerpoolPrice -
            BigInt(winningWorkers.length) * workerReward + // winning workers rewards
            workerTaskStake; // losing worker stake
        await expect(finalizeTx)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(proxyAddress, scheduler.address, schedulerReward)
            .to.emit(iexecPoco, 'Reward')
            .withArgs(scheduler.address, schedulerReward, taskId)
            .to.emit(iexecPoco, 'TaskFinalize')
            .withArgs(taskId, hexResults)
            .to.emit(oracleConsumerInstance, 'GotResult')
            .withArgs(taskId, resultsCallback);
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).equal(TaskStatusEnum.COMPLETED);
        expect(task.results).equal(hexResults);
        expect(task.resultsCallback).equal(resultsCallback);
        await expect(finalizeTx).to.changeTokenBalances(
            iexecPoco,
            [
                iexecPoco,
                requester,
                sponsor,
                appProvider,
                datasetProvider,
                scheduler,
                worker1,
                worker2,
                worker3,
                worker4,
                kittyAddress,
            ],
            [
                -(
                    appPrice + // iExec Poco rewards asset providers and unlock/seize stakes
                    datasetPrice +
                    workerpoolPrice +
                    schedulerTaskStake +
                    workerTaskStake * BigInt(workers.length)
                ),
                0, // requester is unrelated to this test
                0, // sponsor balance is unchanged, only frozen is changed
                appPrice, // app provider is rewarded
                datasetPrice, // dataset provider is rewarded
                schedulerReward + // scheduler is rewarded for first task
                    schedulerTaskStake, // and also get unlocked stake for first task
                workerTaskStake + workerReward, // worker1 is a winning worker
                0, // worker2 is a losing worker
                workerTaskStake + workerReward, // worker3 is a winning worker
                workerTaskStake + workerReward, // worker4 is a winning worker
                0, // See `Should finalize task with scheduler kitty part reward` below for kitty tests
            ],
        );
        expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(requesterFrozenBefore);
        expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(
            sponsorFrozenBefore - taskPrice,
        );
        expect(await iexecPoco.frozenOf(scheduler.address)).to.be.equal(
            schedulerFrozenBefore - schedulerTaskStake,
        );
        for (const worker of workers) {
            expect(await iexecPoco.frozenOf(worker.signer.address)).to.be.equal(
                workersFrozenBefore[worker.signer.address] - workerTaskStake,
            );
        }
        for (const worker of winningWorkers) {
            expect(await iexecPoco.viewScore(worker.address)).to.be.equal(2);
        }
        expect(await iexecPoco.viewScore(losingWorker.address)).to.be.equal(0);
        expect(await iexecPoco.frozenOf(kittyAddress)).to.be.equal(kittyFrozenBefore);
    });

    it('Should finalize task of deal payed by requester (no callback, no dataset)', async () => {
        const orders = buildOrders({
            assets: {
                app: appAddress,
                dataset: ZeroAddress,
                workerpool: workerpoolAddress,
            },
            requester: requester.address,
            prices: ordersPrices,
        });
        const taskPrice = appPrice + workerpoolPrice;
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco.viewDeal(dealId).then((deal) => deal.workerStake);
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            resultDigest,
            worker1,
        );
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker1.address,
            taskId,
            emptyEnclaveAddress,
            scheduler,
        );
        await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
        await iexecPoco
            .connect(worker1)
            .contribute(
                taskId,
                resultHash,
                resultSeal,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                schedulerSignature,
            )
            .then((tx) => tx.wait());
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, resultDigest)
            .then((tx) => tx.wait());
        const requesterFrozenBefore = await iexecPoco.frozenOf(requester.address);
        const sponsorFrozenBefore = await iexecPoco.frozenOf(sponsor.address);

        const txFinalize = iexecPocoAsScheduler.finalize(taskId, results, '0x');
        await expect(txFinalize).to.changeTokenBalances(
            iexecPoco,
            [requester, sponsor, appProvider, datasetProvider],
            [
                0, // requester balance is unchanged, only frozen is changed
                0,
                appPrice, // app provider is rewarded
                0, // but dataset provider is not rewarded
            ],
        );
        await expect(txFinalize).to.emit(iexecPoco, 'TaskFinalize');
        expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(
            requesterFrozenBefore - taskPrice,
        );
        expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(sponsorFrozenBefore);
        const task = await iexecPoco.viewTask(taskId);
        expect(task.resultsCallback).to.equal('0x'); // deal without callback
    });

    it('Should finalize task when callback address is EOA', async () => {
        const callbackEOAAddress = Wallet.createRandom().address;
        const orders = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            callback: callbackEOAAddress,
        });

        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco.viewDeal(dealId).then((deal) => deal.workerStake);
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            callbackResultDigest,
            worker1,
        );
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker1.address,
            taskId,
            emptyEnclaveAddress,
            scheduler,
        );
        await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
        await iexecPoco
            .connect(worker1)
            .contribute(
                taskId,
                resultHash,
                resultSeal,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                schedulerSignature,
            )
            .then((tx) => tx.wait());
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, callbackResultDigest)
            .then((tx) => tx.wait());
        await expect(iexecPocoAsScheduler.finalize(taskId, results, resultsCallback)).to.emit(
            iexecPoco,
            'TaskFinalize',
        );
    });

    it('Should finalize task when callback address is non-EIP1154 contract', async () => {
        const nonEip1154RandomContractAddress = await new OwnableMock__factory()
            .connect(anyone)
            .deploy()
            .then((contract) => contract.waitForDeployment())
            .then((deployedContract) => deployedContract.getAddress());
        const orders = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            callback: nonEip1154RandomContractAddress,
        });

        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco.viewDeal(dealId).then((deal) => deal.workerStake);
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            callbackResultDigest,
            worker1,
        );
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker1.address,
            taskId,
            emptyEnclaveAddress,
            scheduler,
        );
        await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
        await iexecPoco
            .connect(worker1)
            .contribute(
                taskId,
                resultHash,
                resultSeal,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                schedulerSignature,
            )
            .then((tx) => tx.wait());
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, callbackResultDigest)
            .then((tx) => tx.wait());
        await expect(iexecPocoAsScheduler.finalize(taskId, results, resultsCallback)).to.emit(
            iexecPoco,
            'TaskFinalize',
        );
    });

    describe('IexecPoco2#finalize-with-scheduler-kitty-part-reward', async () => {
        [
            {
                testInfo:
                    'scheduler gets 10% of the kitty when these 10% are greater than MIN_KITTY', // (MIN_KITTY=1RLC)
                workerpoolPriceToFillKitty: 33_333_333_367n,
                expectedKittyBeforeFinalize: 10_000_000_010n, // ~10 RLC
                expectedSchedulerKittyPartReward: 1_000_000_001n, // ~1.01 RLC (expectedKittyBeforeFinalize x 10%)
            },
            {
                testInfo: 'scheduler gets at least MIN_KITTY if available',
                workerpoolPriceToFillKitty: 3_333_333_334n,
                expectedKittyBeforeFinalize: 1_000_000_000n, // 1 RLC
                expectedSchedulerKittyPartReward: 1_000_000_000n,
            },
            {
                testInfo: 'scheduler gets all kitty when the kitty is lower than MIN_KITTY',
                workerpoolPriceToFillKitty: 3_333_333_330n,
                expectedKittyBeforeFinalize: 999_999_999n, // ~0.99 RLC
                expectedSchedulerKittyPartReward: 999_999_999n,
            },
        ].forEach((testArgs) => {
            const {
                testInfo,
                workerpoolPriceToFillKitty,
                expectedKittyBeforeFinalize,
                expectedSchedulerKittyPartReward,
            } = testArgs;
            it(`Should finalize task with scheduler kitty part reward where ${testInfo}`, async () => {
                // Fill kitty
                const kittyAddress = await iexecPoco.kitty_address();
                const kittyFillingDealVolume = 1n;
                const kittyFillingSchedulerDealStake = await iexecWrapper.computeSchedulerDealStake(
                    workerpoolPriceToFillKitty,
                    kittyFillingDealVolume,
                );
                const kittyFillingSchedulerTaskStake =
                    kittyFillingSchedulerDealStake / kittyFillingDealVolume;
                const kittyFillingDeal = await iexecWrapper.signAndMatchOrders(
                    ...buildOrders({
                        assets: ordersAssets,
                        requester: requester.address,
                        prices: {
                            app: 0n,
                            dataset: 0n,
                            workerpool: workerpoolPriceToFillKitty, // 30% will go to kitty
                        },
                        volume: kittyFillingDealVolume,
                        salt: ethers.id(new Date().toISOString()),
                    }).toArray(),
                );
                await iexecPoco
                    .initialize(kittyFillingDeal.dealId, kittyFillingDeal.taskIndex)
                    .then((tx) => tx.wait());
                const kittyFrozenBeforeClaim = await iexecPoco.frozenOf(kittyAddress);
                await time.setNextBlockTimestamp(
                    (await iexecPoco.viewTask(kittyFillingDeal.taskId)).finalDeadline,
                );
                const tx = iexecPoco.claim(kittyFillingDeal.taskId);
                await expect(tx).to.changeTokenBalances(
                    iexecPoco,
                    [iexecPoco, kittyAddress],
                    [
                        -workerpoolPriceToFillKitty, // deal payer is refunded
                        0,
                    ],
                );
                await expect(tx)
                    .to.emit(iexecPoco, 'Reward')
                    .withArgs(kittyAddress, kittyFillingSchedulerTaskStake, kittyFillingDeal.taskId)
                    .to.emit(iexecPoco, 'Lock')
                    .withArgs(kittyAddress, kittyFillingSchedulerTaskStake);
                const kittyFrozenAfterClaim = await iexecPoco.frozenOf(kittyAddress);
                expect(kittyFrozenAfterClaim).to.equal(
                    kittyFrozenBeforeClaim + kittyFillingSchedulerTaskStake,
                );
                expect(kittyFrozenAfterClaim).equal(expectedKittyBeforeFinalize);
                // Run flow until finalize to get scheduler kitty part reward
                const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
                    ...buildOrders({
                        assets: ordersAssets,
                        requester: requester.address,
                        prices: {
                            app: 0n,
                            dataset: 0n,
                            workerpool: 0n,
                        },
                        volume: 1n,
                        salt: ethers.id(new Date().toISOString()),
                    }).toArray(),
                );
                await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
                const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                    taskId,
                    resultDigest,
                    worker1,
                );
                await iexecPoco
                    .connect(worker1)
                    .contribute(
                        taskId,
                        resultHash,
                        resultSeal,
                        emptyEnclaveAddress,
                        emptyEnclaveSignature,
                        await buildAndSignContributionAuthorizationMessage(
                            worker1.address,
                            taskId,
                            ZeroAddress,
                            scheduler,
                        ),
                    )
                    .then((tx) => tx.wait());
                await iexecPoco
                    .connect(worker1)
                    .reveal(taskId, resultDigest)
                    .then((tx) => tx.wait());

                const txFinalize = iexecPocoAsScheduler.finalize(taskId, results, '0x');
                await expect(txFinalize).to.changeTokenBalances(
                    iexecPoco,
                    [iexecPoco, scheduler, kittyAddress],
                    [-expectedSchedulerKittyPartReward, expectedSchedulerKittyPartReward, 0],
                );
                await expect(txFinalize)
                    .to.emit(iexecPoco, 'TaskFinalize')
                    .to.emit(iexecPoco, 'Seize')
                    .withArgs(kittyAddress, expectedSchedulerKittyPartReward, taskId)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(proxyAddress, scheduler.address, expectedSchedulerKittyPartReward)
                    .to.emit(iexecPoco, 'Reward')
                    .withArgs(scheduler.address, expectedSchedulerKittyPartReward, taskId);
                expect(await iexecPoco.frozenOf(kittyAddress)).to.equal(
                    kittyFrozenAfterClaim - expectedSchedulerKittyPartReward,
                );
            });
        });
    });

    it('Should finalize task after reveal deadline with at least one reveal', async () => {
        const orders = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            volume: 1n,
            trust: 3n,
        });
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco.viewDeal(dealId).then((deal) => deal.workerStake);
        const workers = [worker1, worker2];
        for (const worker of workers) {
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
            await iexecWrapper.depositInIexecAccount(worker, workerTaskStake);
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
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, resultDigest)
            .then((tx) => tx.wait());
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        expect(task.revealCounter).to.equal(1);
        await time.setNextBlockTimestamp(task.revealDeadline);
        // worker2 did not reveal
        // so task can be finalized after revealDeadline
        await expect(iexecPocoAsScheduler.finalize(taskId, results, '0x')).to.emit(
            iexecPoco,
            'TaskFinalize',
        );
    });

    it('Should not finalize when caller is not scheduler', async () => {
        const { dealId, taskId } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            }).toArray(),
        );
        const deal = await iexecPoco.viewDeal(dealId);
        expect(deal.workerpool.owner).to.equal(scheduler.address).not.equal(anyone.address);
        // caller is not scheduler
        await expect(
            iexecPoco.connect(anyone).finalize(taskId, results, '0x'),
        ).to.be.revertedWithoutReason(); // onlyScheduler modifier
    });

    it('Should not finalize task when task status is not revealing', async () => {
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            }).toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.ACTIVE);
        // caller is scheduler
        // but task status is not revealing
        await expect(
            iexecPocoAsScheduler.finalize(taskId, results, '0x'),
        ).to.be.revertedWithoutReason(); // require#1
    });

    it('Should not finalize task after final deadline', async () => {
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            }).toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco.viewDeal(dealId).then((deal) => deal.workerStake);
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            resultDigest,
            worker1,
        );
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker1.address,
            taskId,
            emptyEnclaveAddress,
            scheduler,
        );
        await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
        await iexecPoco
            .connect(worker1)
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
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        await time.setNextBlockTimestamp(task.finalDeadline);
        // caller is scheduler, task status is revealing
        // but after final deadline
        await expect(
            iexecPocoAsScheduler.finalize(taskId, results, '0x'),
        ).to.be.revertedWithoutReason(); // require#2
    });

    it('Should not finalize when winner counter is not reached nor at least one worker revealed', async () => {
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                trust: 3n,
            }).toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco.viewDeal(dealId).then((deal) => deal.workerStake);
        const workers = [worker1, worker2];
        for (const worker of workers) {
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
            await iexecWrapper.depositInIexecAccount(worker, workerTaskStake);
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
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        expect(task.winnerCounter).to.equal(2).not.equal(task.revealCounter);
        await time.setNextBlockTimestamp(task.revealDeadline);
        // caller is scheduler, task status is revealing, before final deadline
        // winner counter is not reached and reveal deadline is reached but not
        // even one worker revealed
        await expect(
            iexecPocoAsScheduler.finalize(taskId, results, '0x'),
        ).to.be.revertedWithoutReason(); // require#3
    });

    it('Should not finalize task when resultsCallback is not expected', async () => {
        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            ...buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            }).toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco.viewDeal(dealId).then((deal) => deal.workerStake);
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            resultDigest,
            worker1,
        );
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker1.address,
            taskId,
            emptyEnclaveAddress,
            scheduler,
        );
        await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
        await iexecPoco
            .connect(worker1)
            .contribute(
                taskId,
                resultHash,
                resultSeal,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                schedulerSignature,
            )
            .then((tx) => tx.wait());
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, resultDigest)
            .then((tx) => tx.wait());
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        expect(task.revealCounter).to.equal(1);
        // caller is scheduler, task status is revealing, before final deadline,
        // reveal counter is reached
        // but resultsCallback is not expected
        await expect(
            iexecPocoAsScheduler.finalize(taskId, results, '0x01'),
        ).to.be.revertedWithoutReason(); // require#4
    });

    it('Should not finalize task when result callback is bad', async () => {
        const oracleConsumerAddress = await new TestClient__factory()
            .connect(anyone)
            .deploy()
            .then((contract) => contract.waitForDeployment())
            .then((deployedContract) => deployedContract.getAddress());
        const orders = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            callback: oracleConsumerAddress,
        });

        const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
            ...orders.toArray(),
        );
        await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
        const workerTaskStake = await iexecPoco.viewDeal(dealId).then((deal) => deal.workerStake);
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            callbackResultDigest,
            worker1,
        );
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            worker1.address,
            taskId,
            emptyEnclaveAddress,
            scheduler,
        );
        await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
        await iexecPoco
            .connect(worker1)
            .contribute(
                taskId,
                resultHash,
                resultSeal,
                emptyEnclaveAddress,
                emptyEnclaveSignature,
                schedulerSignature,
            )
            .then((tx) => tx.wait());
        await iexecPoco
            .connect(worker1)
            .reveal(taskId, callbackResultDigest)
            .then((tx) => tx.wait());
        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.REVEALING);
        expect(task.revealCounter).to.equal(1);
        // caller is scheduler, task status is revealing, before final deadline,
        // reveal counter is reached
        // but resultsCallback is bad
        const { resultsCallback } = buildResultCallbackAndDigest(567);
        await expect(
            iexecPocoAsScheduler.finalize(taskId, results, resultsCallback),
        ).to.be.revertedWithoutReason(); // require#4 (part 2)
    });

    async function setWorkerScoreInStorage(worker: string, score: number) {
        const workerScoreSlot = ethers.stripZerosLeft(
            ethers.keccak256(
                AbiCoder.defaultAbiCoder().encode(
                    ['address', 'uint256'],
                    [
                        worker,
                        18, // Slot index of m_workerScores in Store
                    ],
                ),
            ),
        );
        await setStorageAt(proxyAddress, workerScoreSlot, score);
    }
});
