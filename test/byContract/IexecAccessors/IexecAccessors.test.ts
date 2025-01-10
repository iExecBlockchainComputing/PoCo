// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero, HashZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments, ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import {
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    createOrderOperation,
} from '../../../utils/createOrders';
import {
    ContributionStatusEnum,
    OrderOperationEnum,
    TaskStatusEnum,
    buildResultCallbackAndDigest,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
    getTaskId,
} from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

/**
 * Test state view functions.
 */

const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);

let proxyAddress: string;
let iexecPoco: IexecInterfaceNative;
let iexecWrapper: IexecWrapper;
let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
let [requester, appProvider, datasetProvider, scheduler, worker1, anyone]: SignerWithAddress[] = [];
let ordersAssets: OrdersAssets;
let ordersPrices: OrdersPrices;

describe('IexecAccessors', async () => {
    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ requester, appProvider, datasetProvider, scheduler, worker1, anyone } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, ethers.provider);
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

    it('balanceOf', async function () {
        const amount = 3;
        await iexecWrapper.depositInIexecAccount(anyone, amount);
        expect(await iexecPoco.balanceOf(anyone.address)).to.equal(amount);
    });

    it('frozenOf', async function () {
        await createDeal(); // Lock some requester funds.
        const dealPrice = appPrice + datasetPrice + workerpoolPrice; // volume == 1
        expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealPrice);
    });

    it('allowance', async function () {
        const amount = 10;
        const spender = ethers.Wallet.createRandom().address;
        await iexecWrapper.depositInIexecAccount(anyone, amount);
        await iexecPoco.connect(anyone).approve(spender, amount);
        expect(await iexecPoco.allowance(anyone.address, spender)).to.equal(amount);
    });

    it('viewAccount', async function () {
        await createDeal(); // Lock some requester funds.
        const dealPrice = appPrice + datasetPrice + workerpoolPrice;
        // Stake some funds.
        const stakedBalance = 3;
        await iexecWrapper.depositInIexecAccount(requester, stakedBalance);
        // Check staked and locked amounts.
        const account = await iexecPoco.viewAccount(requester.address);
        expect(account.stake).to.equal(stakedBalance);
        expect(account.locked).to.equal(dealPrice);
    });

    // TODO test the case where token() == 0x0 in native mode.
    it('token', async function () {
        expect(await iexecPoco.token()).to.equal('0x5FbDB2315678afecb367f032d93F642f64180aa3');
    });

    it('viewDeal', async function () {
        const { dealId } = await createDeal();
        const deal = await iexecPoco.viewDeal(dealId);
        expect(deal.app.pointer).to.equal(appAddress);
        expect(deal.app.owner).to.equal(appProvider.address);
        expect(deal.app.price).to.equal(appPrice);
        expect(deal.dataset.pointer).to.equal(datasetAddress);
        expect(deal.dataset.owner).to.equal(datasetProvider.address);
        expect(deal.dataset.price).to.equal(datasetPrice);
        expect(deal.workerpool.pointer).to.equal(workerpoolAddress);
        expect(deal.workerpool.owner).to.equal(scheduler.address);
        expect(deal.workerpool.price).to.equal(workerpoolPrice);
        expect(deal.trust).to.equal(1);
        expect(deal.category).to.equal(0);
        expect(deal.tag).to.equal(HashZero); // Standard
        expect(deal.requester).to.equal(requester.address);
        expect(deal.beneficiary).to.equal(AddressZero);
        expect(deal.callback).to.equal(AddressZero);
        expect(deal.params).to.equal('');
        expect(deal.startTime).to.be.greaterThan(0);
        expect(deal.botFirst).to.equal(0);
        expect(deal.botSize).to.equal(1);
        expect(deal.workerStake).to.be.greaterThan(0);
        expect(deal.schedulerRewardRatio).to.be.greaterThan(0);
        expect(deal.sponsor).to.equal(requester.address);
    });

    it('viewConsumed', async function () {
        const { orders } = await createDeal();
        expect(await iexecPoco.viewConsumed(iexecWrapper.hashOrder(orders.app))).to.equal(1);
    });

    it('viewPresigned', async function () {
        const appOrder = buildOrders({ assets: ordersAssets, requester: requester.address }).app;
        const orderOperation = createOrderOperation(appOrder, OrderOperationEnum.SIGN);
        await iexecWrapper.signOrderOperation(orderOperation, appProvider);
        await iexecPoco
            .connect(appProvider)
            .manageAppOrder(orderOperation)
            .then((tx) => tx.wait());
        expect(await iexecPoco.viewPresigned(iexecWrapper.hashOrder(appOrder))).equal(
            appProvider.address,
        );
    });

    it('viewTask', async function () {
        const { dealId, taskId, taskIndex, startTime, timeRef } = await createDeal();
        await iexecWrapper.initializeTask(dealId, taskIndex);

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

    it('viewContribution', async function () {
        const { dealId, taskIndex, taskId } = await createDeal();
        await iexecWrapper.initializeTask(dealId, taskIndex);
        await iexecWrapper.contributeToTask(dealId, taskIndex, resultDigest, worker1);
        const contribution = await iexecPoco.viewContribution(taskId, worker1.address);
        expect(contribution.status).to.equal(ContributionStatusEnum.CONTRIBUTED);
        expect(contribution.resultHash.length).to.equal(66);
        expect(contribution.resultSeal.length).to.equal(66);
        expect(contribution.enclaveChallenge).to.equal(AddressZero);
        expect(contribution.weight).to.equal(1);
    });

    it('viewScore', async function () {
        // TODO
        expect(await iexecPoco.viewScore(worker1.address)).to.equal(0);
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

            await iexecWrapper
                .initializeTask(dealId, taskIndex)
                .then(() =>
                    iexecWrapper.contributeToTask(dealId, taskIndex, callbackResultDigest, worker1),
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
            const activeTaskId = await iexecWrapper.initializeTask(dealId, 1);
            const { taskId: revealingTaskId } = await iexecWrapper
                .initializeTask(dealId, 2)
                .then(() => iexecWrapper.contributeToTask(dealId, 2, resultDigest, worker1));

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
        prices: ordersPrices,
        requester: requester.address,
        volume,
    });
    const { dealId, taskId, taskIndex, startTime } = await iexecWrapper.signAndMatchOrders(
        ...orders.toArray(),
    );
    const dealCategory = (await iexecPoco.viewDeal(dealId)).category;
    const timeRef = (await iexecPoco.viewCategory(dealCategory)).workClockTimeRef.toNumber();
    return { dealId, taskId, taskIndex, startTime, timeRef, orders };
}

async function verifyTaskStatusAndResult(taskId: string, expectedStatus: number) {
    const task = await iexecPoco.viewTask(taskId);
    expect(task.status).to.equal(expectedStatus);
    await expect(iexecPoco.resultFor(taskId)).to.be.revertedWith('task-pending');
}
