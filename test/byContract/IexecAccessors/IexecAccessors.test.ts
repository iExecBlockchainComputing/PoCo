// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { HashZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments, ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import { IexecInterfaceNative, IexecInterfaceNative__factory } from '../../../typechain';
import { OrdersAssets, OrdersPrices, buildOrders } from '../../../utils/createOrders';
import { TaskStatusEnum, getIexecAccounts } from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

/**
 * Test state view functions.
 */

let proxyAddress: string;
let iexecPocoAsAnyone: IexecInterfaceNative;
let iexecWrapper: IexecWrapper;
let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
let [requester, anyone]: SignerWithAddress[] = [];

describe('IexecAccessors', async () => {
    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ requester, anyone } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
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

    it('viewTask', async function () {
        const { dealId, taskId, taskIndex, startTime, timeRef } = await createTask();
        const contributionDeadlineRatio = (
            await iexecPocoAsAnyone.contribution_deadline_ratio()
        ).toNumber();
        const finalDeadlineRatio = (await iexecPocoAsAnyone.final_deadline_ratio()).toNumber();

        const task = await iexecPocoAsAnyone.viewTask(taskId);
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
});

/**
 * Build orders, create a deal, and initialize task.
 */
async function createTask() {
    const appPrice = 1000;
    const datasetPrice = 1_000_000;
    const workerpoolPrice = 1_000_000_000;
    const callback = ethers.Wallet.createRandom().address;
    const ordersAssets: OrdersAssets = {
        app: appAddress,
        dataset: datasetAddress,
        workerpool: workerpoolAddress,
    };
    const ordersPrices: OrdersPrices = {
        app: appPrice,
        dataset: datasetPrice,
        workerpool: workerpoolPrice,
    };
    const orders = buildOrders({
        assets: ordersAssets,
        prices: ordersPrices,
        requester: requester.address,
        callback: callback,
    });
    const { dealId, taskId, taskIndex, startTime } = await iexecWrapper.signAndMatchOrders(
        ...orders.toArray(),
    );
    const deal = await iexecPocoAsAnyone.viewDeal(dealId);
    const timeRef = (
        await iexecPocoAsAnyone.viewCategory(deal.category)
    ).workClockTimeRef.toNumber();
    await iexecPocoAsAnyone.initialize(dealId, taskIndex).then((tx) => tx.wait());
    return { dealId, taskId, taskIndex, startTime, timeRef };
}
