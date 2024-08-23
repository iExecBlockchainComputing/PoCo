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
    IexecOrders,
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    signOrders,
} from '../../../utils/createOrders';
import { getDealId, getIexecAccounts, setNextBlockTimestamp } from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';

/*
 * TODO add TEE tests
 */

const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const trust = 3;
const category = 2;
const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const callback = ethers.Wallet.createRandom().address;
const params = '<params>';
const volume = 321;
const taskIndex = 0;
const randomAddress = ethers.Wallet.createRandom().address;

describe('IexecPoco1', () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsRequester]: IexecInterfaceNative[] = [];
    let iexecWrapper: IexecWrapper;
    let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
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
    let orders: IexecOrders;

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
        ({ orders } = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            beneficiary: beneficiary.address,
            tag: standardDealTag,
            volume: volume,
            callback: callback,
            trust: trust,
            category: category,
            params: params,
        }));
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
        it('[Standard] Should match orders with all assets, callback, and BoT', async () => {
            // Recreate orders here instead of using the default ones created
            // in beforeEach to make this test as explicit as possible.
            const { orders } = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: standardDealTag,
                volume: volume,
                callback: callback,
                trust: trust,
                category: category,
                params: params,
            });
            expect(await iexecPoco.balanceOf(proxyAddress)).to.equal(0);
            // Compute prices, stakes, rewards, ...
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            const workerStakePerTask = await iexecWrapper.computeWorkerTaskStake(
                workerpoolAddress,
                workerpoolPrice,
            );
            const schedulerRewardByTask =
                await iexecWrapper.getSchedulerTaskRewardRatio(workerpoolAddress);
            // Deposit required amounts.
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            // Check balances and frozen before.
            expect(await iexecPoco.balanceOf(requester.address)).to.equal(dealPrice);
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(0);
            expect(await iexecPoco.balanceOf(scheduler.address)).to.equal(schedulerStake);
            expect(await iexecPoco.frozenOf(scheduler.address)).to.equal(0);
            // Sign and match orders.
            const startTime = await setNextBlockTimestamp();
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
            const tx = iexecPocoAsRequester.matchOrders(...orders.toArray());
            // Check balances and frozen after.
            await expect(tx).to.changeTokenBalances(
                iexecPoco,
                [iexecPoco, requester, scheduler],
                [dealPrice + schedulerStake, -dealPrice, -schedulerStake],
            );
            // TODO use predicate `(change) => boolean` when migrating to a recent version of Hardhat.
            // See https://github.com/NomicFoundation/hardhat/blob/main/packages/hardhat-chai-matchers/src/internal/changeTokenBalance.ts#L42
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealPrice);
            expect(await iexecPoco.frozenOf(scheduler.address)).to.equal(schedulerStake);
            // Check events.
            await expect(tx)
                .to.emit(iexecPoco, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    volume,
                );
            // Check deal
            const deal = await iexecPoco.viewDeal(dealId);
            expect(deal.app.pointer).to.equal(appAddress);
            expect(deal.app.owner).to.equal(appProvider.address);
            expect(deal.app.price.toNumber()).to.equal(appPrice);
            expect(deal.dataset.pointer).to.equal(datasetAddress);
            expect(deal.dataset.owner).to.equal(datasetProvider.address);
            expect(deal.dataset.price.toNumber()).to.equal(datasetPrice);
            expect(deal.workerpool.pointer).to.equal(workerpoolAddress);
            expect(deal.workerpool.owner).to.equal(scheduler.address);
            expect(deal.workerpool.price.toNumber()).to.equal(workerpoolPrice);
            expect(deal.trust.toNumber()).to.equal(trust);
            expect(deal.category.toNumber()).to.equal(category);
            expect(deal.tag).to.equal(standardDealTag);
            expect(deal.requester).to.equal(requester.address);
            expect(deal.beneficiary).to.equal(beneficiary.address);
            expect(deal.callback).to.equal(callback);
            expect(deal.params).to.equal(params);
            expect(deal.startTime.toNumber()).to.equal(startTime);
            expect(deal.botFirst.toNumber()).to.equal(0);
            expect(deal.botSize.toNumber()).to.equal(volume);
            expect(deal.workerStake.toNumber()).to.equal(workerStakePerTask);
            expect(deal.schedulerRewardRatio.toNumber()).to.equal(schedulerRewardByTask);
            expect(deal.sponsor).to.equal(requester.address);
        });

        it('[Standard] Should match orders without callback', async () => {
            orders.requester.callback = AddressZero;
            await depositForRequesterAndSchedulerWithDefaultPrices();
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester, taskIndex);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.emit(
                iexecPoco,
                'OrdersMatched',
            );
            // Check deal
            const deal = await iexecPoco.viewDeal(dealId);
            expect(deal.callback).to.equal(AddressZero);
        });

        it('[Standard] Should match orders without dataset', async () => {
            orders.dataset.dataset = AddressZero;
            orders.requester.dataset = AddressZero;
            // Compute prices, stakes, rewards, ...
            const dealPrice = (appPrice + workerpoolPrice) * volume; // no dataset price
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            // Deposit required amounts.
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester, taskIndex);
            const tx = iexecPocoAsRequester.matchOrders(...orders.toArray());
            // Check balances and frozen.
            // Dataset price shouldn't be included.
            await expect(tx).to.changeTokenBalances(
                iexecPoco,
                [iexecPoco, requester, scheduler],
                [dealPrice + schedulerStake, -dealPrice, -schedulerStake],
            );
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealPrice);
            // Check events.
            await expect(tx).to.emit(iexecPoco, 'OrdersMatched');
            // Check deal
            const deal = await iexecPoco.viewDeal(dealId);
            expect(deal.dataset.pointer).to.equal(AddressZero);
            expect(deal.dataset.owner).to.equal(AddressZero);
            expect(deal.dataset.price.toNumber()).to.equal(0);
            // Should not be impacted by datasetVolume == 0
            expect(deal.botSize.toNumber()).to.equal(volume);
        });

        it('[Standard] Should not match orders with bad request order category', async () => {
            orders.requester.category = category + 1; // Valid but bad category.
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x00',
            );
        });

        it('[Standard] Should not match orders with invalid category', async () => {
            orders.requester.category = 123;
            orders.workerpool.category = 123;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x01',
            );
        });

        it('[Standard] Should not match orders with bad request order trust', async () => {
            orders.requester.trust = 123;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x02',
            );
        });

        it('[Standard] Should not match orders with bad request order app price', async () => {
            orders.requester.appmaxprice = Number(orders.app.appprice) - 1;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x03',
            );
        });

        it('[Standard] Should not match orders with bad request order dataset price', async () => {
            orders.requester.datasetmaxprice = Number(orders.dataset.datasetprice) - 1;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x04',
            );
        });

        it('[Standard] Should not match orders with bad request order workerpool price', async () => {
            orders.requester.workerpoolmaxprice = Number(orders.workerpool.workerpoolprice) - 1;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x05',
            );
        });

        it('[Standard] Should not match orders with bad request order tag', async () => {
            orders.requester.tag = toBytes32('0x1101'); // Random, bytes32 short form.
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x06',
            );
        });

        it('[Standard] Should not match orders with bad app order tag', async () => {
            orders.app.tag = toBytes32('0x1101'); // Random, bytes32 short form.
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x06',
            );
        });

        it('[Standard] Should not match orders with bad dataset order tag', async () => {
            orders.app.tag = toBytes32('0x1101'); // Random, bytes32 short form.
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x06',
            );
        });

        it('[Standard] Should not match orders with bad workerpool order tag', async () => {
            orders.app.tag = toBytes32('0x1000'); // Random
            orders.dataset.tag = toBytes32('0x1100'); // Random
            orders.requester.tag = toBytes32('0x1010'); // Random
            // Workerpool order has to satisfy conditions of different actors.
            orders.workerpool.tag = toBytes32('0x1100'); // Bad tag, correct tag should be 0x001110
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x06',
            );
        });

        it('[Standard] Should not match orders when TEE tag is not requested by app', async () => {
            orders.app.tag = standardDealTag;
            orders.dataset.tag = teeDealTag;
            orders.requester.tag = teeDealTag;
            orders.workerpool.tag = teeDealTag;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x07',
            );
        });

        it('[Standard] Should not match orders with app mismatch', async () => {
            orders.requester.app = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x10',
            );
        });

        it('[Standard] Should not match orders with dataset mismatch', async () => {
            orders.requester.dataset = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x11',
            );
        });

        it('[Standard] Should not match orders with workerpool mismatch', async () => {
            orders.requester.workerpool = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x12',
            );
        });

        it('[Standard] Should not match orders when dataset restrict of app order is not matched', async () => {
            orders.app.datasetrestrict = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x13',
            );
        });

        it('[Standard] Should not match orders when workerpool restrict of app order is not matched', async () => {
            orders.app.workerpoolrestrict = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x14',
            );
        });

        it('[Standard] Should not match orders when requester restrict of app order is not matched', async () => {
            orders.app.requesterrestrict = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x15',
            );
        });

        it('[Standard] Should not match orders when app restrict of dataset order is not matched', async () => {
            orders.dataset.apprestrict = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x16',
            );
        });

        it('[Standard] Should not match orders when workerpool restrict of dataset order is not matched', async () => {
            orders.dataset.workerpoolrestrict = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x17',
            );
        });

        it('[Standard] Should not match orders when requester restrict of dataset order is not matched', async () => {
            orders.dataset.requesterrestrict = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x18',
            );
        });

        it('[Standard] Should not match orders when app restrict of workerpool order is not matched', async () => {
            orders.workerpool.apprestrict = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x19',
            );
        });

        it('[Standard] Should not match orders when dataset restrict of workerpool order is not matched', async () => {
            orders.workerpool.datasetrestrict = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x1a',
            );
        });

        it('[Standard] Should not match orders when requester restrict of workerpool order is not matched', async () => {
            orders.workerpool.requesterrestrict = randomAddress;
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x1b',
            );
        });

        it('[TODO] Should match orders with replication', () => {});
    });
    describe('[TODO] Sponsor match orders', () => {});

    /**
     * Helper function to deposit requester and scheduler stakes with
     * default prices for tests that do not rely on price changes.
     */
    async function depositForRequesterAndSchedulerWithDefaultPrices() {
        const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
        const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            volume,
        );
        // Deposit required amounts.
        await iexecWrapper.depositInIexecAccount(requester, dealPrice);
        await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
    }

    /**
     * Pad string argument with zeros to make it 32 bytes length.
     * @param hexString string to pad
     * @returns the input hex string padded with zeros to reach 32 bytes
     */
    function toBytes32(hexString: string) {
        return ethers.utils.hexZeroPad(hexString, 32);
    }
});
