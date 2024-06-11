// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
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

const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const hexResults = ethers.utils.hexlify(results);
const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);

const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const taskPrice = appPrice + datasetPrice + workerpoolPrice;
const emptyEnclaveAddress = ethers.constants.AddressZero;
const emptyEnclaveSignature = '0x';

describe('Poco', async () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsAnyone]: IexecInterfaceNative[] = [];
    let iexecWrapper: IexecWrapper;
    let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
    let [
        iexecAdmin,
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
            iexecAdmin,
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
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, iexecAdmin);
        iexecPocoAsAnyone = iexecPoco.connect(anyone);
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

    describe('Finalize', async function () {
        it('Should finalize task of deal payed by sponsor', async function () {
            const oracleConsumerInstance = await new TestClient__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.deployed());
            const expectedVolume = 3; // > 1 to explicit taskPrice vs dealPrice
            const remainingTasksToFinalize = expectedVolume - 1;
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume: expectedVolume,
                trust: 3,
                callback: oracleConsumerInstance.address,
            });
            const { dealId, taskId, taskIndex, dealPrice } =
                await iexecWrapper.signAndSponsorMatchOrders(orders);
            const schedulerDealStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                expectedVolume,
            );
            const schedulerTaskStake = schedulerDealStake / expectedVolume;
            const kittyAddress = await iexecPoco.kitty_address();
            await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const workerTaskStake = await iexecPoco
                .viewDeal(dealId)
                .then((deal) => deal.workerStake.toNumber());
            const { callbackResultDigest: wrongCallbackResultDigest } =
                buildResultCallbackAndDigest(567);
            const workers = [
                { wallet: worker1, callbackResultDigest: callbackResultDigest },
                { wallet: worker2, callbackResultDigest: wrongCallbackResultDigest },
                { wallet: worker3, callbackResultDigest: callbackResultDigest },
                { wallet: worker4, callbackResultDigest: callbackResultDigest },
            ];
            const winningWorkers = [worker1, worker3, worker4];
            const losingWorker = worker2;
            for (const worker of workers) {
                const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                    taskId,
                    worker.callbackResultDigest,
                    worker.wallet,
                );
                const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                    worker.wallet.address,
                    taskId,
                    emptyEnclaveAddress,
                    scheduler,
                );
                await iexecWrapper.depositInIexecAccount(worker.wallet, workerTaskStake);
                await iexecPoco
                    .connect(worker.wallet)
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
            expect(await iexecPoco.balanceOf(iexecPoco.address)).to.be.equal(
                dealPrice + schedulerDealStake + workers.length * workerTaskStake,
            );
            expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.balanceOf(sponsor.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(dealPrice);
            expect(await iexecPoco.balanceOf(appProvider.address)).to.be.equal(0);
            expect(await iexecPoco.balanceOf(datasetProvider.address)).to.be.equal(0);
            expect(await iexecPoco.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(scheduler.address)).to.be.equal(schedulerDealStake);
            for (const worker of [...winningWorkers, losingWorker]) {
                expect(await iexecPoco.balanceOf(worker.address)).to.be.equal(0);
                expect(await iexecPoco.frozenOf(worker.address)).to.be.equal(workerTaskStake);
                expect(await iexecPoco.viewScore(worker.address)).to.be.equal(0);
            }
            expect(await iexecPoco.balanceOf(kittyAddress)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(kittyAddress)).to.be.equal(0);
            expect((await iexecPoco.viewTask(taskId)).status).to.equal(TaskStatusEnum.REVEALING);

            const finalizeTx = await iexecPoco
                .connect(scheduler)
                .finalize(taskId, results, resultsCallback);
            await finalizeTx.wait();
            await expect(finalizeTx)
                .to.emit(iexecPoco, 'Seize')
                .withArgs(sponsor.address, taskPrice, taskId)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, appProvider.address, appPrice)
                .to.emit(iexecPoco, 'Reward')
                .withArgs(appProvider.address, appPrice, taskId)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, datasetProvider.address, datasetPrice)
                .to.emit(iexecPoco, 'Reward')
                .withArgs(datasetProvider.address, datasetPrice, taskId)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, scheduler.address, schedulerTaskStake)
                .to.emit(iexecPoco, 'Unlock')
                .withArgs(scheduler.address, schedulerTaskStake);
            const workerReward = 429000000;
            for (const worker of winningWorkers) {
                await expect(finalizeTx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(iexecPoco.address, worker.address, workerTaskStake)
                    .to.emit(iexecPoco, 'Unlock')
                    .withArgs(worker.address, workerTaskStake)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(iexecPoco.address, worker.address, workerReward)
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
                winningWorkers.length * workerReward + // winning workers rewards
                workerTaskStake; // losing worker stake
            await expect(finalizeTx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(iexecPoco.address, scheduler.address, schedulerReward)
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
            expect(await iexecPoco.balanceOf(iexecPoco.address)).to.be.equal(
                remainingTasksToFinalize * (taskPrice + schedulerTaskStake),
            );
            expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.balanceOf(sponsor.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(
                remainingTasksToFinalize * taskPrice,
            );
            expect(await iexecPoco.balanceOf(appProvider.address)).to.be.equal(appPrice);
            expect(await iexecPoco.balanceOf(datasetProvider.address)).to.be.equal(datasetPrice);
            expect(await iexecPoco.balanceOf(scheduler.address)).to.be.equal(
                schedulerTaskStake + // unlocked stake from first task
                    schedulerReward, // reward from first task
            );
            expect(await iexecPoco.frozenOf(scheduler.address)).to.be.equal(
                remainingTasksToFinalize * schedulerTaskStake,
            );
            for (const worker of winningWorkers) {
                expect(await iexecPoco.balanceOf(worker.address)).to.be.equal(
                    workerTaskStake + workerReward,
                );
                expect(await iexecPoco.frozenOf(worker.address)).to.be.equal(0);
                expect(await iexecPoco.viewScore(worker.address)).to.be.equal(1);
            }
            expect(await iexecPoco.balanceOf(losingWorker.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(losingWorker.address)).to.be.equal(0);
            // TODO: Add score history to losing worker to test score punishing
            expect(await iexecPoco.viewScore(losingWorker.address)).to.be.equal(0);
            // TODO: Update test with non-empty kitty
            expect(await iexecPoco.balanceOf(kittyAddress)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(kittyAddress)).to.be.equal(0);
        });

        it('Should finalize task of deal payed by requester', async function () {
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
            });
            const { dealId, taskId, taskIndex, dealPrice } =
                await iexecWrapper.signAndMatchOrders(orders);
            await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const workerTaskStake = await iexecPoco
                .viewDeal(dealId)
                .then((deal) => deal.workerStake.toNumber());
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
            expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(taskPrice);
            expect(await iexecPoco.balanceOf(sponsor.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(0);

            await expect(iexecPoco.connect(scheduler).finalize(taskId, results, '0x'))
                .to.emit(iexecPoco, 'Seize')
                .withArgs(requester.address, taskPrice, taskId)
                .to.emit(iexecPoco, 'TaskFinalize');
            expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.balanceOf(sponsor.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(sponsor.address)).to.be.equal(0);
        });
    });

    // TODO: Continue `finalize` tests migration (`Should/Should not`)
});
