// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { assert, expect } from 'chai';
import { ZeroAddress, ZeroHash } from 'ethers';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import config from '../../../utils/config';
import { NULL } from '../../../utils/constants';
import { IexecOrders, OrdersAssets, OrdersPrices, buildOrders } from '../../../utils/createOrders';
import {
    ContributionStatusEnum,
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildAndSignPocoClassicEnclaveMessage,
    buildResultHash,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
    setNextBlockTimestamp,
} from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';

const timeRef = BigInt(config.categories[0].workClockTimeRef);
const volume = 3n;
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const standardDealTag = ZeroHash;
const { resultDigest } = buildUtf8ResultAndDigest('result');
const { resultDigest: badResultDigest } = buildUtf8ResultAndDigest('bad-result');
const emptyEnclaveAddress = ZeroAddress;
const emptyEnclaveSignature = NULL.SIGNATURE;

describe('IexecPoco2#contribute', () => {
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
        enclave,
        sms,
        requester,
    ]: SignerWithAddress[] = [];
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;
    let defaultOrders: IexecOrders;

    beforeEach(async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({
            scheduler,
            worker,
            worker1,
            worker2,
            worker3,
            worker4,
            enclave,
            sms,
            requester,
            anyone,
        } = accounts);
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
        defaultOrders = buildOrders({
            assets: ordersAssets,
            requester: requester.address,
            prices: ordersPrices,
            volume,
            trust: 0n,
            tag: standardDealTag,
        });
    }

    describe('Contribute', () => {
        it('Should contribute TEE task with multiple workers and broker', async () => {
            await iexecWrapper.setTeeBroker(sms.address);
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                    trust: 3n,
                    tag: teeDealTag,
                }).toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const workerTaskStake = await iexecPoco
                .viewDeal(dealId)
                .then((deal) => deal.workerStake);
            const workers = [
                { signer: worker1, resultDigest: resultDigest },
                { signer: worker2, resultDigest: badResultDigest },
                { signer: worker3, resultDigest: resultDigest },
                { signer: worker4, resultDigest: resultDigest },
            ];
            const winningWorkers = [worker1, worker3, worker4];
            // worker2 is a losing worker
            let task;
            let contributeBlockTimestamp;
            const viewFrozenOf = (address: string) => iexecPoco.frozenOf(address);
            for (let i = 0; i < workers.length; i++) {
                const worker = workers[i];
                const workerAddress = worker.signer.address;
                const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                    taskId,
                    worker.resultDigest,
                    worker.signer,
                );
                await iexecWrapper.depositInIexecAccount(worker.signer, workerTaskStake);
                const frozenBefore = await viewFrozenOf(workerAddress);
                contributeBlockTimestamp = await setNextBlockTimestamp();
                const tx = await iexecPoco
                    .connect(worker.signer)
                    .contribute(
                        taskId,
                        resultHash,
                        resultSeal,
                        enclave.address,
                        await buildAndSignPocoClassicEnclaveMessage(
                            resultHash,
                            resultSeal,
                            enclave,
                        ),
                        await buildAndSignContributionAuthorizationMessage(
                            workerAddress,
                            taskId,
                            enclave.address,
                            sms,
                        ),
                    );
                await tx.wait();
                const contribution = await iexecPoco.viewContribution(taskId, workerAddress);
                expect(contribution.status).equal(ContributionStatusEnum.CONTRIBUTED);
                expect(contribution.resultHash).equal(resultHash);
                expect(contribution.resultSeal).equal(resultSeal);
                expect(contribution.enclaveChallenge).equal(enclave.address);
                task = await iexecPoco.viewTask(taskId);
                expect(task.contributors.length).equal(i + 1);
                expect(task.contributors[i]).equal(workerAddress);

                // The matcher 'emit' cannot be chained after 'changeTokenBalances' - https://hardhat.org/chaining-async-matchers
                await expect(tx).to.changeTokenBalances(
                    iexecPoco,
                    [workerAddress, proxyAddress],
                    [-workerTaskStake, workerTaskStake],
                );
                await expect(tx)
                    .to.emit(iexecPoco, 'Transfer')
                    .withArgs(workerAddress, proxyAddress, workerTaskStake);
                expect(await viewFrozenOf(workerAddress)).equal(frozenBefore + workerTaskStake);
                await expect(tx)
                    .to.emit(iexecPoco, 'Lock')
                    .withArgs(workerAddress, workerTaskStake)
                    .to.emit(iexecPoco, 'TaskContribute')
                    .withArgs(taskId, workerAddress, resultHash);
                expect(contribution.weight).equal(1); // no worker history
                // m_consensus does not have any getter for checking group & total
                const taskConsensusEvent: [contract: any, eventName: string] = [
                    iexecPoco,
                    'TaskConsensus',
                ];
                if (i == workers.length - 1) {
                    // last worker settles the consensus (here worker4)
                    await expect(tx)
                        .to.emit(...taskConsensusEvent)
                        .withArgs(taskId, resultHash);
                } else {
                    await expect(tx).to.not.emit(...taskConsensusEvent);
                }
            }
            assert(task != undefined);
            expect(task.status).equal(TaskStatusEnum.REVEALING);
            expect(task.consensusValue).equal(buildResultHash(taskId, resultDigest));
            assert(contributeBlockTimestamp != undefined);
            expect(task.revealDeadline).equal(contributeBlockTimestamp + timeRef * 2n);
            expect(task.revealCounter).equal(0);
            expect(task.winnerCounter).equal(winningWorkers.length);
        });

        it('Should contribute TEE task with one worker', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                    trust: 0n,
                    tag: teeDealTag,
                }).toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const workerTaskStake = await iexecPoco
                .viewDeal(dealId)
                .then((deal) => deal.workerStake);
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker,
            );
            await iexecWrapper.depositInIexecAccount(worker, workerTaskStake);
            await expect(
                iexecPocoAsWorker.contribute(
                    taskId,
                    resultHash,
                    resultSeal,
                    enclave.address,
                    await buildAndSignPocoClassicEnclaveMessage(resultHash, resultSeal, enclave),
                    await buildAndSignContributionAuthorizationMessage(
                        worker.address,
                        taskId,
                        enclave.address,
                        scheduler,
                    ),
                ),
            ).to.emit(iexecPoco, 'TaskConsensus');
        });

        it('Should contribute standard task', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...defaultOrders.toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const workerTaskStake = await iexecPoco
                .viewDeal(dealId)
                .then((deal) => deal.workerStake);
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker,
            );
            await iexecWrapper.depositInIexecAccount(worker, workerTaskStake);
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
            ).to.emit(iexecPoco, 'TaskConsensus');
        });

        it('Should not contribute when task not active', async () => {
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

        it('Should not contribute after deadline', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...defaultOrders.toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            expect((await iexecPoco.viewTask(taskId)).status).equal(TaskStatusEnum.ACTIVE);
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

        it('Should not contribute twice', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                    trust: 3n, // so consensus is not yet reached on first contribution
                    tag: standardDealTag,
                }).toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const workerTaskStake = await iexecPoco
                .viewDeal(dealId)
                .then((deal) => deal.workerStake);
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
            expect((await iexecPoco.viewContribution(taskId, worker.address)).status).equal(
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

        it('Should not contribute when enclave challenge for TEE task is missing', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                    trust: 0n,
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

        it('Should not contribute when scheduler signature is invalid', async () => {
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

        it('Should not contribute when enclave signature is invalid', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: ordersPrices,
                    volume,
                    trust: 0n,
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

        it('Should not contribute when no deposit', async () => {
            const { dealId, taskIndex, taskId } = await iexecWrapper.signAndMatchOrders(
                ...defaultOrders.toArray(),
            );
            await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                resultDigest,
                worker,
            );
            // active task, before deadline, not contributed, enclave challenge
            // not required, valid scheduler signature, enclave signature not required
            // but worker deposit missing
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
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });
    });
});
