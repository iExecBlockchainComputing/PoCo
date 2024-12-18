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
    PocoMode,
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

    it(`[6.${5 - 1}] No sponsorship, no beneficiary, no callback, no BoT, up to ${5} workers`, async function () {
        const volume = 1;
        const workers = [worker1, worker2, worker3, worker4];
        const accounts = [requester, scheduler, appProvider, datasetProvider, ...workers];

        const contributionBatchs: {
            [key: number]: {
                worker: SignerWithAddress;
                useEnclave: boolean;
            }[];
        } = {
            0: [
                { worker: worker1, useEnclave: false },
                { worker: worker2, useEnclave: true },
            ],
            1: [
                { worker: worker1, useEnclave: false },
                { worker: worker3, useEnclave: true },
                { worker: worker4, useEnclave: true },
            ],
        };
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
        const workersRewardPerTask = await iexecWrapper.computeWorkersRewardPerTask(
            dealId,
            PocoMode.CLASSIC,
        );
        const schedulerRewardPerTask = workerpoolPrice - workersRewardPerTask;
        const accountsInitialFrozens = await iexecWrapper.getInitialFrozens(accounts);

        for (let i = 0; i < 4; i++) {
            expect(await iexecPoco.viewScore(workers[i].address)).to.be.equal(0);
        }
        const taskId = await iexecWrapper.initializeTask(dealId, 0);
        const workerStakePerTask = await iexecPoco
            .viewDeal(dealId)
            .then((deal) => deal.workerStake.toNumber());
        for (const contribution of contributionBatchs[0]) {
            if (contribution.useEnclave) {
                await iexecWrapper.contributeToTeeTask(
                    dealId,
                    0,
                    resultDigest,
                    contribution.worker,
                );
            } else {
                await iexecWrapper.contributeToTask(dealId, 0, resultDigest, contribution.worker);
            }
        }
        const task = await iexecPoco.viewTask(taskId);
        await setNextBlockTimestamp(task.revealDeadline).then(() => mine());

        await expect(iexecPocoAsScheduler.reopen(taskId))
            .to.emit(iexecPoco, 'TaskReopen')
            .withArgs(taskId);

        for (const contribution of contributionBatchs[1]) {
            if (contribution.useEnclave) {
                await iexecWrapper.contributeToTeeTask(
                    dealId,
                    0,
                    resultDigest,
                    contribution.worker,
                );
            } else {
                const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                    taskId,
                    resultDigest,
                    contribution.worker,
                );
                const enclaveAddress = AddressZero;
                const enclaveSignature = '0x';
                const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                    contribution.worker.address,
                    taskId,
                    enclaveAddress,
                    scheduler,
                );
                await expect(
                    iexecPoco
                        .connect(contribution.worker)
                        .contribute(
                            taskId,
                            resultHash,
                            resultSeal,
                            enclaveAddress,
                            enclaveSignature,
                            schedulerSignature,
                        ),
                ).to.revertedWithoutReason();
            }
        }
        for (const contribution of contributionBatchs[1].slice(1)) {
            await iexecPoco
                .connect(contribution.worker)
                .reveal(taskId, resultDigest)
                .then((tx) => tx.wait());
        }
        const finalizeTx = await iexecPocoAsScheduler.finalize(taskId, results, '0x');
        await finalizeTx.wait();
        // const expectedProxyBalanceChange = -(
        //     dealPrice +
        //     schedulerStakePerTask +
        //     workerStakePerTask * workers.length
        // );
        // const expectedWinningWorkerBalanceChange =
        //     workerStakePerTask + workersRewardPerTask / 5;
        // await expect(finalizeTx).to.changeTokenBalances(
        //     iexecPoco,
        //     [proxyAddress, ...accounts],
        //     [
        //         expectedProxyBalanceChange,
        //         0,
        //         schedulerStakePerTask + schedulerRewardPerTask,
        //         appPrice,
        //         datasetPrice,
        //         ...workers.map(() => expectedWinningWorkerBalanceChange), // Workers
        //     ],
        // );
        // expect((await iexecPoco.viewTask(taskId)).status).to.equal(
        //     TaskStatusEnum.COMPLETED,
        // );
        // const expectedFrozenChanges = [
        //     0,
        //     -taskPrice,
        //     -schedulerStakePerTask,
        //     0,
        //     0,
        //     ...workers.map(() => 0),
        // ];
        // await iexecWrapper.checkFrozenChanges(
        //     accountsInitialFrozens,
        //     expectedFrozenChanges,
        // );
        // for (let i = 0; i < 5; i++) {
        //     expect(await iexecPoco.viewScore(workers[i].address)).to.be.equal(
        //         5 == 1 ? 0 : 1,
        //     );
        // }
    });

    async function getInitialScores(
        workers: SignerWithAddress[],
    ): Promise<{ [address: string]: number }> {
        const scores: { [address: string]: number } = {};
        for (const worker of workers) {
            scores[worker.address] = (await iexecPoco.viewScore(worker.address)).toNumber();
        }
        return scores;
    }
});

async function validateScores(
    initialScores: { [address: string]: number },
    winningWorkers: SignerWithAddress[],
    loosingWorkers: SignerWithAddress[],
    nonParticipantWorkers: SignerWithAddress[],
) {
    for (const winningWorker of winningWorkers) {
        const currentScore = (await iexecPoco.viewScore(winningWorker.address)).toNumber();
        expect(currentScore, `Worker ${winningWorker.address} score mismatch`).to.equal(
            initialScores[winningWorker.address] + 1,
        );
    }
    for (const loosingWorker of loosingWorkers) {
        const currentScore = (await iexecPoco.viewScore(loosingWorker.address)).toNumber();
        expect(currentScore, `Worker ${loosingWorker.address} score mismatch`).to.equal(
            initialScores[loosingWorker.address] - 1,
        );
    }
    for (const nonParticipantWorker of nonParticipantWorkers) {
        const currentScore = (await iexecPoco.viewScore(nonParticipantWorker.address)).toNumber();
        expect(currentScore, `Worker ${nonParticipantWorker.address} score mismatch`).to.equal(
            initialScores[nonParticipantWorker.address],
        );
    }
}
