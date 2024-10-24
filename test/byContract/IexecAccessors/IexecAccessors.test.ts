// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments, ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
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
describe('IexecAccessors', async () => {
    let proxyAddress: string;
    let iexecPocoAsAnyone: IexecInterfaceNative;
    let anyone: SignerWithAddress;

    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ anyone } = accounts);
        iexecPocoAsAnyone = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
    }

    it('name', async function () {
        expect(await iexecPocoAsAnyone.name()).to.equal('Staked RLC');
    });
    it('symbol', async function () {
        expect(await iexecPocoAsAnyone.symbol()).to.equal('SRLC');
    });
    it('decimals', async function () {
        expect(await iexecPocoAsAnyone.decimals()).to.equal(9n);
    });
    it('totalSupply', async function () {
        expect(await iexecPocoAsAnyone.totalSupply()).to.equal(0n);
    });
    // TODO test the case where token() == 0x0 in native mode.
    it('token', async function () {
        expect(await iexecPocoAsAnyone.token()).to.equal(
            '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        );
    });
    it('countCategory', async function () {
        expect(await iexecPocoAsAnyone.countCategory()).to.equal(5);
    });
    it('appRegistry', async function () {
        expect(await iexecPocoAsAnyone.appregistry()).to.equal(
            (await deployments.get('AppRegistry')).address,
        );
    });
    it('datasetRegistry', async function () {
        expect(await iexecPocoAsAnyone.datasetregistry()).to.equal(
            (await deployments.get('DatasetRegistry')).address,
        );
    });
    it('workerpoolRegistry', async function () {
        expect(await iexecPocoAsAnyone.workerpoolregistry()).to.equal(
            (await deployments.get('WorkerpoolRegistry')).address,
        );
    });
    it('teeBroker', async function () {
        expect(await iexecPocoAsAnyone.teebroker()).to.equal(ethers.constants.AddressZero);
    });
    it('callbackGas', async function () {
        expect(await iexecPocoAsAnyone.callbackgas()).to.equal(100_000n);
    });
    it('contributionDeadlineRatio', async function () {
        expect(await iexecPocoAsAnyone.contribution_deadline_ratio()).to.equal(7);
    });
    it('revealDeadlineRatio', async function () {
        expect(await iexecPocoAsAnyone.reveal_deadline_ratio()).to.equal(2n);
    });
    it('finalDeadlineRatio', async function () {
        expect(await iexecPocoAsAnyone.final_deadline_ratio()).to.equal(10n);
    });
    it('workerpoolStakeRatio', async function () {
        expect(await iexecPocoAsAnyone.workerpool_stake_ratio()).to.equal(30n);
    });
    it('kittyRatio', async function () {
        expect(await iexecPocoAsAnyone.kitty_ratio()).to.equal(10n);
    });
    it('kittyMin', async function () {
        expect(await iexecPocoAsAnyone.kitty_min()).to.equal(1_000_000_000n);
    });
    it('kittyAddress', async function () {
        expect(await iexecPocoAsAnyone.kitty_address()).to.equal(
            '0x99c2268479b93fDe36232351229815DF80837e23',
        );
    });
    it('groupMemberPurpose', async function () {
        expect(await iexecPocoAsAnyone.groupmember_purpose()).to.equal(4n);
    });
    it('eip712domainSeparator', async function () {
        expect(await iexecPocoAsAnyone.eip712domain_separator()).to.equal(
            '0xfc2178d8b8300e657cb9f8b5a4d1957174cf1392e294f3575b82a9cea1da1c4b',
        );
    });

    describe('resultFor', () => {
        let iexecWrapper: IexecWrapper;
        let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
        let [requester, scheduler, worker1]: SignerWithAddress[] = [];
        let ordersAssets: OrdersAssets;
        const { results, resultDigest } = buildUtf8ResultAndDigest('result');
        const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);

        beforeEach(async () => {
            const accounts = await getIexecAccounts();
            iexecWrapper = new IexecWrapper(proxyAddress, accounts);
            ({ requester, scheduler, worker1 } = accounts);
            ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
            ordersAssets = {
                app: appAddress,
                dataset: datasetAddress,
                workerpool: workerpoolAddress,
            };
        });
        it('Should get result of task', async function () {
            const orders = buildOrders({ assets: ordersAssets, requester: requester.address });
            const { dealId, taskId, taskIndex } = await iexecWrapper.signAndMatchOrders(
                ...orders.toArray(),
            );

            await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());

            const workerTaskStake = await iexecPocoAsAnyone
                .viewDeal(dealId)
                .then((deal) => deal.workerStake.toNumber());
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                taskId,
                callbackResultDigest,
                worker1,
            );
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker1.address,
                taskId,
                AddressZero,
                scheduler,
            );
            await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
            await iexecPocoAsAnyone
                .connect(worker1)
                .contribute(taskId, resultHash, resultSeal, AddressZero, '0x', schedulerSignature)
                .then((tx) => tx.wait());

            await iexecPocoAsAnyone
                .connect(worker1)
                .reveal(taskId, callbackResultDigest)
                .then((tx) => tx.wait());
            await iexecPocoAsAnyone
                .connect(scheduler)
                .finalize(taskId, results, resultsCallback)
                .then((tx) => tx.wait());
            const task = await iexecPocoAsAnyone.viewTask(taskId);
            await expect(task.status).to.equal(TaskStatusEnum.COMPLETED);
            await expect(await iexecPocoAsAnyone.callStatic.resultFor(taskId)).to.equal(
                resultsCallback,
            );
        });
        it('Should not get result when task is not completed', async function () {
            const volume = 3;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                volume,
            });

            const { dealId } = await iexecWrapper.signAndMatchOrders(...orders.toArray());

            const tasks: string[] = [];
            tasks.push(getTaskId(dealId, 0));
            for (let taskIndex = 1; taskIndex < volume; taskIndex++) {
                await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
                tasks.push(getTaskId(dealId, taskIndex));
            }
            const { resultHash, resultSeal } = buildResultHashAndResultSeal(
                tasks[2],
                resultDigest,
                worker1,
            );
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker1.address,
                tasks[2],
                AddressZero,
                scheduler,
            );

            const workerTaskStake = await iexecPocoAsAnyone
                .viewDeal(dealId)
                .then((deal) => deal.workerStake.toNumber());

            await iexecWrapper.depositInIexecAccount(worker1, workerTaskStake);
            await iexecPocoAsAnyone
                .connect(worker1)
                .contribute(tasks[2], resultHash, resultSeal, AddressZero, '0x', schedulerSignature)
                .then((tx) => tx.wait());

            await verifyTaskStatusAndResult(tasks[0], TaskStatusEnum.UNSET);
            await verifyTaskStatusAndResult(tasks[1], TaskStatusEnum.ACTIVE);
            await verifyTaskStatusAndResult(tasks[2], TaskStatusEnum.REVEALING);
        });
        const verifyTaskStatusAndResult = async (taskId: string, expectedStatus: number) => {
            const task = await iexecPocoAsAnyone.viewTask(taskId);
            await expect(task.status).to.equal(expectedStatus);
            await expect(iexecPocoAsAnyone.resultFor(taskId)).to.be.revertedWith('task-pending');
        };
    });
});
