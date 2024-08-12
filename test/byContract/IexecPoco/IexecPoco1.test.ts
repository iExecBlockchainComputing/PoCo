// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    IexecPocoAccessors__factory,
} from '../../../typechain';
import {
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    signOrders,
} from '../../../utils/createOrders';
import { getDealId, getIexecAccounts } from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

/*
 * TODO add TEE tests
 */

const taskIndex = 0;
const volume = taskIndex + 1;
const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';

describe('IexecPoco1', () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsRequester]: IexecInterfaceNative[] = [];
    let iexecWrapper: IexecWrapper;
    let [appAddress, workerpoolAddress, datasetAddress]: string[] = [];
    let [
        iexecAdmin,
        requester,
        sponsor,
        beneficiary,
        appProvider,
        datasetProvider,
        scheduler,
        anyone,
    ]: SignerWithAddress[] = [];
    let ordersActors: OrdersActors;
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
            beneficiary,
            appProvider,
            datasetProvider,
            scheduler,
            anyone,
        } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        await iexecWrapper.setTeeBroker(ethers.constants.AddressZero);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsRequester = iexecPoco.connect(requester);
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
        // TODO check why this is done in 00_matchorders.js
        // await Workerpool__factory.connect(workerpoolAddress, scheduler)
        //     .changePolicy(35, 5)
        //     .then((tx) => tx.wait());
    }

    // TODO
    describe('Verify signature', () => {});
    describe('Verify presignature', () => {});
    describe('Verify presignature or signature', () => {});

    describe('Match orders', () => {
        it('Should match orders with all assets (Standard)', async () => {
            const { orders } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: standardDealTag,
                prices: ordersPrices,
                callback: AddressZero,
            });
            expect(await iexecPoco.balanceOf(proxyAddress)).to.be.equal(0);
            // Compute prices, stakes, rewards, ...
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            const workerStakeByTask = await iexecWrapper.computeWorkerTaskStake(
                workerpoolAddress,
                workerpoolPrice,
            );
            const schedulerRewardByTask =
                await iexecWrapper.getSchedulerTaskRewardRatio(workerpoolAddress);
            // Deposit required amounts.
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            // Check balances before.
            expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.balanceOf(scheduler.address)).to.be.equal(schedulerStake);
            expect(await iexecPoco.frozenOf(scheduler.address)).to.be.equal(0);
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            const { appOrderHash, datasetOrderHash, workerpoolOrderHash, requestOrderHash } =
                iexecWrapper.hashOrders(orders);
            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester, taskIndex);
            expect(
                await IexecPocoAccessors__factory.connect(proxyAddress, anyone).computeDealVolume(
                    ...orders.toArray(),
                ),
            ).to.equal(volume);

            expect(await iexecPocoAsRequester.callStatic.matchOrders(...orders.toArray())).to.equal(
                dealId,
            );
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray()))
                .to.emit(iexecPoco, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    volume,
                );
            // Check balances after.
            expect(await iexecPoco.balanceOf(proxyAddress)).to.be.equal(dealPrice + schedulerStake);
            expect(await iexecPoco.balanceOf(requester.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(requester.address)).to.be.equal(dealPrice);
            expect(await iexecPoco.balanceOf(scheduler.address)).to.be.equal(0);
            expect(await iexecPoco.frozenOf(scheduler.address)).to.be.equal(schedulerStake);
            // Check deal
            const deal = await iexecPoco.viewDeal(dealId);
            expect(deal.app.pointer).to.equal(appAddress);
            expect(deal.app.owner).to.equal(appProvider.address);
            expect(Number(deal.app.price)).to.equal(appPrice);
            expect(deal.dataset.pointer).to.equal(datasetAddress);
            expect(deal.dataset.owner).to.equal(datasetProvider.address);
            expect(Number(deal.dataset.price)).to.equal(datasetPrice);
            expect(deal.workerpool.pointer).to.equal(workerpoolAddress);
            expect(deal.workerpool.owner).to.equal(scheduler.address);
            expect(Number(deal.workerpool.price)).to.equal(workerpoolPrice);
            expect(Number(deal.trust)).to.equal(1);
            expect(Number(deal.category)).to.equal(0);
            expect(Number(deal.tag)).to.equal(0x0);
            expect(deal.requester).to.equal(requester.address);
            expect(deal.beneficiary).to.equal(beneficiary.address);
            expect(deal.callback).to.equal(AddressZero);
            expect(deal.params).to.equal('<params>');
            expect(Number(deal.startTime)).greaterThan(0);
            expect(Number(deal.botFirst)).to.equal(0);
            expect(Number(deal.botSize)).to.equal(volume);
            expect(Number(deal.workerStake)).to.equal(workerStakeByTask);
            expect(Number(deal.schedulerRewardRatio)).to.equal(schedulerRewardByTask);
            expect(deal.sponsor).to.equal(requester.address);
        });

        it('[TODO] Should match orders with all assets and callback (Standard)', () => {});
        it('[TODO] Should match orders without dataset (Standard)', () => {});
        it('[TODO] Should match orders without dataset and with callback (Standard)', () => {});
        it('[TODO] Should match orders with replication', () => {});
    });
    describe('[TODO] Sponsor match orders', () => {});
});
