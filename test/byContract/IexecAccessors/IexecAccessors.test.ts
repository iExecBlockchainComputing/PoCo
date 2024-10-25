// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero, HashZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments, ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    TestClient__factory,
} from '../../../typechain';
import { OrdersAssets, buildOrders } from '../../../utils/createOrders';
import {
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildResultCallbackAndDigest,
    buildResultHashAndResultSeal,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
    getTaskId,
} from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

/**
 * Test state view functions.
 */

const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);

let proxyAddress: string;
let iexecPoco: IexecInterfaceNative;
let iexecWrapper: IexecWrapper;
let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
let [requester, scheduler, worker1, anyone]: SignerWithAddress[] = [];
let ordersAssets: OrdersAssets;
let callbackAddress: string;

describe('IexecAccessors', async () => {
    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ requester, scheduler, worker1, anyone } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        ordersAssets = {
            app: appAddress,
            dataset: datasetAddress,
            workerpool: workerpoolAddress,
        };
        callbackAddress = await new TestClient__factory()
            .connect(anyone)
            .deploy()
            .then((contract) => contract.deployed())
            .then((contract) => contract.address);
    }

    it('name', async function () {
        expect(await iexecPoco.name()).to.equal('Staked RLC');
    });

    it('symbol', async function () {
        expect(await iexecPoco.symbol()).to.equal('SRLC');
    });

    it('decimals', async function () {
        expect(await iexecPoco.decimals()).to.equal(9n);
    });

    it('totalSupply', async function () {
        expect(await iexecPoco.totalSupply()).to.equal(0n);
    });

    // TODO test the case where token() == 0x0 in native mode.
    it('token', async function () {
        expect(await iexecPoco.token()).to.equal('0x5FbDB2315678afecb367f032d93F642f64180aa3');
    });

    it('viewTask', async function () {
        const { dealId, taskId, taskIndex, startTime, timeRef } = await createDeal();
        await initializeTask(dealId, taskIndex);

        const contributionDeadlineRatio = (
            await iexecPoco.contribution_deadline_ratio()
        ).toNumber();
        const finalDeadlineRatio = (await iexecPoco.final_deadline_ratio()).toNumber();

        const task = await iexecPoco.viewTask(taskId);
        expect(task.status).to.equal(TaskStatusEnum.ACTIVE);
        expect(task.dealid).to.equal(dealId);
        expect(task.idx).to.equal(taskIndex);
        expect(task.timeref).to.equal(timeRef);
        expect(task.contributionDeadline).to.equal(startTime + timeRef * contributionDeadlineRatio);
        expect(task.revealDeadline).to.equal(0);
        expect(task.finalDeadline).to.equal(startTime + timeRef * finalDeadlineRatio);
        expect(task.consensusValue).to.equal(HashZero);
        expect(task.revealCounter).to.equal(0);
        expect(task.winnerCounter).to.equal(0);
        expect(task.contributors.length).to.equal(0);
        expect(task.resultDigest).to.equal(HashZero);
        expect(task.results).to.equal('0x');
        expect(task.resultsTimestamp).to.equal(0);
        expect(task.resultsCallback).to.equal('0x');
    });

    it('countCategory', async function () {
        expect(await iexecPoco.countCategory()).to.equal(5);
    });

    it('appRegistry', async function () {
        expect(await iexecPoco.appregistry()).to.equal(
            (await deployments.get('AppRegistry')).address,
        );
    });

    it('datasetRegistry', async function () {
        expect(await iexecPoco.datasetregistry()).to.equal(
            (await deployments.get('DatasetRegistry')).address,
        );
    });

    it('workerpoolRegistry', async function () {
        expect(await iexecPoco.workerpoolregistry()).to.equal(
            (await deployments.get('WorkerpoolRegistry')).address,
        );
    });

    it('teeBroker', async function () {
        expect(await iexecPoco.teebroker()).to.equal(ethers.constants.AddressZero);
    });

    it('callbackGas', async function () {
        expect(await iexecPoco.callbackgas()).to.equal(100_000n);
    });

    it('contributionDeadlineRatio', async function () {
        expect(await iexecPoco.contribution_deadline_ratio()).to.equal(7);
    });

    it('revealDeadlineRatio', async function () {
        expect(await iexecPoco.reveal_deadline_ratio()).to.equal(2n);
    });

    it('finalDeadlineRatio', async function () {
        expect(await iexecPoco.final_deadline_ratio()).to.equal(10n);
    });

    it('workerpoolStakeRatio', async function () {
        expect(await iexecPoco.workerpool_stake_ratio()).to.equal(30n);
    });

    it('kittyRatio', async function () {
        expect(await iexecPoco.kitty_ratio()).to.equal(10n);
    });

    it('kittyMin', async function () {
        expect(await iexecPoco.kitty_min()).to.equal(1_000_000_000n);
    });

    it('kittyAddress', async function () {
        expect(await iexecPoco.kitty_address()).to.equal(
            '0x99c2268479b93fDe36232351229815DF80837e23',
        );
    });

    it('groupMemberPurpose', async function () {
        expect(await iexecPoco.groupmember_purpose()).to.equal(4n);
    });

    it('eip712domainSeparator', async function () {
        expect(await iexecPoco.eip712domain_separator()).to.equal(
            '0xfc2178d8b8300e657cb9f8b5a4d1957174cf1392e294f3575b82a9cea1da1c4b',
        );
    });

    describe('resultFor', () => {
        it('Should get result of task', async function () {
            const { dealId, taskId, taskIndex } = await createDeal();

            await initializeTask(dealId, taskIndex).then(() =>
                contributeToTask(dealId, taskIndex, callbackResultDigest),
            );
            await iexecPoco
                .connect(worker1)
                .reveal(taskId, callbackResultDigest)
                .then((tx) => tx.wait());
            await iexecPoco
                .connect(scheduler)
                .finalize(taskId, results, resultsCallback)
                .then((tx) => tx.wait());
            const task = await iexecPoco.viewTask(taskId);
            expect(task.status).to.equal(TaskStatusEnum.COMPLETED);
            expect(await iexecPoco.callStatic.resultFor(taskId)).to.equal(resultsCallback);
        });

        it('Should not get result when task is not completed', async function () {
            const { dealId } = await createDeal(3);

            const unsetTaskId = getTaskId(dealId, 0);
            const activeTaskId = await initializeTask(dealId, 1);
            const revealingTaskId = await initializeTask(dealId, 2).then(() =>
                contributeToTask(dealId, 2, resultDigest),
            );

            await verifyTaskStatusAndResult(unsetTaskId, TaskStatusEnum.UNSET);
            await verifyTaskStatusAndResult(activeTaskId, TaskStatusEnum.ACTIVE);
            await verifyTaskStatusAndResult(revealingTaskId, TaskStatusEnum.REVEALING);
        });
    });
});

/**
 * Helper function to create a deal with a specific volume.
 */
async function createDeal(volume: number = 1) {
    const orders = buildOrders({
        assets: ordersAssets,
        requester: requester.address,
        volume,
        callback: callbackAddress,
    });
    const { dealId, taskId, taskIndex, startTime } = await iexecWrapper.signAndMatchOrders(
        ...orders.toArray(),
    );
    const dealCategory = (await iexecPoco.viewDeal(dealId)).category;
    const timeRef = (await iexecPoco.viewCategory(dealCategory)).workClockTimeRef.toNumber();
    return { dealId, taskId, taskIndex, startTime, timeRef };
}

/**
 * Helper function to initialize a task.
 */
async function initializeTask(dealId: string, taskIndex: number) {
    await iexecPoco.initialize(dealId, taskIndex).then((tx) => tx.wait());
    return getTaskId(dealId, taskIndex);
}

/**
 * Helper function to contribute to a task.
 */
async function contributeToTask(dealId: string, taskIndex: number, resultDigest: string) {
    const taskId = getTaskId(dealId, taskIndex);
    const workerTaskStake = await iexecPoco
        .viewDeal(dealId)
        .then((deal) => deal.workerStake.toNumber());
    const { resultHash, resultSeal } = buildResultHashAndResultSeal(taskId, resultDigest, worker1);
    const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
        worker1.address,
        taskId,
        AddressZero,
        scheduler,
    );
    await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
    await iexecPoco
        .connect(worker1)
        .contribute(taskId, resultHash, resultSeal, AddressZero, '0x', schedulerSignature)
        .then((tx) => tx.wait());
    return taskId;
}

async function verifyTaskStatusAndResult(taskId: string, expectedStatus: number) {
    const task = await iexecPoco.viewTask(taskId);
    expect(task.status).to.equal(expectedStatus);
    await expect(iexecPoco.resultFor(taskId)).to.be.revertedWith('task-pending');
}
