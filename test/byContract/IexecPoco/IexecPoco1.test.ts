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
    TestClient,
    TestClient__factory,
} from '../../../typechain';
import { IexecPoco1 } from '../../../typechain/contracts/modules/interfaces/IexecPoco1.v8.sol';
import { IexecPoco1__factory } from '../../../typechain/factories/contracts/modules/interfaces/IexecPoco1.v8.sol';
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
 * TODO add Standard tests.
 */

const appPrice = 1000;
const datasetPrice = 1_000_000;
const workerpoolPrice = 1_000_000_000;
const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const volume = 321;

describe('IexecPoco1', () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsRequester]: IexecInterfaceNative[] = [];
    let iexecPocoAsSponsor: IexecPoco1; // Sponsor function not available in IexecInterfaceNative yet.
    let iexecWrapper: IexecWrapper;
    let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
    let [
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
    let randomAddress: string;
    let randomContract: TestClient;

    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ requester, sponsor, beneficiary, appProvider, datasetProvider, scheduler, anyone } =
            accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsRequester = iexecPoco.connect(requester);
        iexecPocoAsSponsor = IexecPoco1__factory.connect(proxyAddress, sponsor);
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
            tag: teeDealTag,
            volume: volume,
        }));
        randomAddress = ethers.Wallet.createRandom().address;
        randomContract = await new TestClient__factory()
            .connect(anyone)
            .deploy()
            .then((contract) => contract.deployed());
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
        it('[TEE] Should match orders with all assets, beneficiary, BoT, callback, replication', async () => {
            const callback = ethers.Wallet.createRandom().address;
            const trust = 3;
            const category = 2;
            const params = '<params>';
            // Use orders with full configuration.
            const { orders: fullConfigOrders } = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
                volume: volume,
                callback: callback,
                trust: trust,
                category: category,
                params: params,
            });
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
            // Sign and match orders.
            const startTime = await setNextBlockTimestamp();
            await signOrders(iexecWrapper.getDomain(), fullConfigOrders, ordersActors);
            const { appOrderHash, datasetOrderHash, workerpoolOrderHash, requestOrderHash } =
                iexecWrapper.hashOrders(fullConfigOrders);
            const dealId = getDealId(iexecWrapper.getDomain(), fullConfigOrders.requester);
            expect(
                await IexecPocoAccessors__factory.connect(proxyAddress, anyone).computeDealVolume(
                    ...fullConfigOrders.toArray(),
                ),
            ).to.equal(volume);

            expect(
                await iexecPocoAsRequester.callStatic.matchOrders(...fullConfigOrders.toArray()),
            ).to.equal(dealId);
            const tx = iexecPocoAsRequester.matchOrders(...fullConfigOrders.toArray());
            // Check balances and frozen.
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
            expect(deal.app.price).to.equal(appPrice);
            expect(deal.dataset.pointer).to.equal(datasetAddress);
            expect(deal.dataset.owner).to.equal(datasetProvider.address);
            expect(deal.dataset.price).to.equal(datasetPrice);
            expect(deal.workerpool.pointer).to.equal(workerpoolAddress);
            expect(deal.workerpool.owner).to.equal(scheduler.address);
            expect(deal.workerpool.price).to.equal(workerpoolPrice);
            expect(deal.trust).to.equal(trust);
            expect(deal.category).to.equal(category);
            expect(deal.tag).to.equal(teeDealTag);
            expect(deal.requester).to.equal(requester.address);
            expect(deal.beneficiary).to.equal(beneficiary.address);
            expect(deal.callback).to.equal(callback);
            expect(deal.params).to.equal(params);
            expect(deal.startTime).to.equal(startTime);
            expect(deal.botFirst).to.equal(0);
            expect(deal.botSize).to.equal(volume);
            expect(deal.workerStake).to.equal(workerStakePerTask);
            expect(deal.schedulerRewardRatio).to.equal(schedulerRewardByTask);
            expect(deal.sponsor).to.equal(requester.address);
        });

        it.only('[Standard] Should match orders with all assets, beneficiary, BoT, callback, replication', async () => {
            const callback = ethers.Wallet.createRandom().address;
            const trust = 3;
            const category = 2;
            const params = '<params>';
            // Use orders with full configuration.
            const { orders: standardOrders } = buildOrders({
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
            await depositForRequesterAndSchedulerWithDefaultPrices();
            // Sign and match orders.
            const startTime = await setNextBlockTimestamp();
            await signOrders(iexecWrapper.getDomain(), standardOrders, ordersActors);
            const dealId = getDealId(iexecWrapper.getDomain(), standardOrders.requester);
            await expect(iexecPocoAsRequester.matchOrders(...standardOrders.toArray())).to.emit(
                iexecPoco,
                'OrdersMatched',
            );
            // Check deal
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
            expect(deal.trust).to.equal(trust);
            expect(deal.category).to.equal(category);
            expect(deal.tag).to.equal(standardDealTag);
            expect(deal.requester).to.equal(requester.address);
            expect(deal.beneficiary).to.equal(beneficiary.address);
            expect(deal.callback).to.equal(callback);
            expect(deal.params).to.equal(params);
            expect(deal.startTime).to.equal(startTime);
            expect(deal.botFirst).to.equal(0);
            expect(deal.botSize).to.equal(volume);
            expect(deal.workerStake).to.equal(
                await iexecWrapper.computeWorkerTaskStake(workerpoolAddress, workerpoolPrice),
            );
            expect(deal.schedulerRewardRatio).to.equal(
                await iexecWrapper.getSchedulerTaskRewardRatio(workerpoolAddress),
            );
            expect(deal.sponsor).to.equal(requester.address);
        });

        it('[TEE] Should match orders without beneficiary, BoT, callback, replication', async () => {
            await depositForRequesterAndSchedulerWithDefaultPrices();
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.emit(
                iexecPoco,
                'OrdersMatched',
            );
            // Check deal
            const deal = await iexecPoco.viewDeal(dealId);
            expect(deal.beneficiary).to.equal(AddressZero);
            expect(deal.botSize).to.equal(1);
            expect(deal.callback).to.equal(AddressZero);
            expect(deal.trust).to.equal(1);
        });

        it.only('[TEE] Should sponsor match orders', async () => {
            // Compute prices, stakes, rewards, ...
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            // Deposit required amounts.
            await iexecWrapper.depositInIexecAccount(sponsor, dealPrice);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);
            const tx = iexecPocoAsSponsor.sponsorMatchOrders(...orders.toArray());
            // Check balances and frozen.
            await expect(tx).to.changeTokenBalances(
                iexecPoco,
                [iexecPoco, sponsor, scheduler, requester],
                [dealPrice + schedulerStake, -dealPrice, -schedulerStake, 0],
            );
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(0);
            expect(await iexecPoco.frozenOf(sponsor.address)).to.equal(dealPrice);
            expect(await iexecPoco.frozenOf(scheduler.address)).to.equal(schedulerStake);
            // Check events.
            await expect(tx).to.emit(iexecPoco, 'OrdersMatched');
            // Check deal
            const deal = await iexecPoco.viewDeal(dealId);
            expect(deal.sponsor).to.equal(sponsor.address);
        });

        it('[TEE] Should match orders without dataset', async () => {
            orders.dataset.dataset = AddressZero;
            orders.requester.dataset = AddressZero;
            // Set dataset volume lower than other assets to make sure
            // it does not impact final volume computation.
            orders.dataset.volume = volume - 1;
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
            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);
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
            expect(deal.dataset.price).to.equal(0);
            // BoT size should not be impacted even if the dataset order is the order with the lowest volume
            expect(deal.botSize).to.equal(volume);
        });

        it('[TEE] Should match orders without beneficiary, BoT, callback, replication', async () => {
            await depositForRequesterAndSchedulerWithDefaultPrices();
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.emit(
                iexecPoco,
                'OrdersMatched',
            );
            // Check deal
            const deal = await iexecPoco.viewDeal(dealId);
            expect(deal.beneficiary).to.equal(AddressZero);
            expect(deal.botSize).to.equal(1);
            expect(deal.callback).to.equal(AddressZero);
            expect(deal.trust).to.equal(1);
        });

        it(`[TEE] Should match orders with full restrictions in all orders`, async function () {
            orders.app.datasetrestrict = orders.dataset.dataset;
            orders.app.workerpoolrestrict = orders.workerpool.workerpool;
            orders.app.requesterrestrict = orders.requester.requester;

            orders.dataset.apprestrict = orders.app.app;
            orders.dataset.workerpoolrestrict = orders.workerpool.workerpool;
            orders.dataset.requesterrestrict = orders.requester.requester;

            orders.workerpool.apprestrict = orders.app.app;
            orders.workerpool.datasetrestrict = orders.dataset.dataset;
            orders.workerpool.requesterrestrict = orders.requester.requester;

            await depositForRequesterAndSchedulerWithDefaultPrices();
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.emit(
                iexecPoco,
                'OrdersMatched',
            );
        });

        /**
         * Successful match orders with partial restrictions.
         */
        // No restrictions in request order.
        ['app', 'dataset', 'workerpool'].forEach((orderName) => {
            ['app', 'dataset', 'workerpool', 'requester'].forEach((assetName) => {
                // Filter irrelevant cases (e.g. app - app).
                if (orderName.includes(assetName)) {
                    return;
                }
                it(`[TEE] Should match orders with ${assetName} restriction in ${orderName} order`, async function () {
                    // e.g. orders.app.datasetrestrict = orders.dataset.dataset
                    orders[orderName][assetName + 'restrict'] = orders[assetName][assetName];
                    await depositForRequesterAndSchedulerWithDefaultPrices();
                    // Sign and match orders.
                    await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
                    await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.emit(
                        iexecPoco,
                        'OrdersMatched',
                    );
                });
            });
        });

        // TODO add success tests for:
        //   - identity groups
        //   - pre-signatures
        //   - low orders volumes
        //   - multiple matches of the same order

        it('[TEE] Should fail when categories are different', async () => {
            orders.requester.category = Number(orders.workerpool.category) + 1; // Valid but different category.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x00',
            );
        });

        it('[TEE] Should fail when category is unknown', async () => {
            const lastCategoryIndex = (await iexecPoco.countCategory()).toNumber() - 1;
            orders.requester.category = lastCategoryIndex + 1;
            orders.workerpool.category = lastCategoryIndex + 1;
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x01',
            );
        });

        it('[TEE] Should fail when requested trust is above workerpool trust', async () => {
            orders.requester.trust = Number(orders.workerpool.trust) + 1;
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x02',
            );
        });

        it('[TEE] Should fail when app max price is less than app price', async () => {
            orders.requester.appmaxprice = Number(orders.app.appprice) - 1;
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x03',
            );
        });

        it('[TEE] Should fail when dataset max price is less than dataset price', async () => {
            orders.requester.datasetmaxprice = Number(orders.dataset.datasetprice) - 1;
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x04',
            );
        });

        it('[TEE] Should fail when workerpool max price is less than workerpool price', async () => {
            orders.requester.workerpoolmaxprice = Number(orders.workerpool.workerpoolprice) - 1;
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x05',
            );
        });

        it('[TEE] Should fail when workerpool tag does not satisfy app, dataset and request requirements', async () => {
            orders.app.tag = '0x0000000000000000000000000000000000000000000000000000000000000001'; // 0b0001
            orders.dataset.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000002'; // 0b0010
            orders.requester.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            // Workerpool order is supposed to satisfy conditions of all actors.
            // Bad tag, correct tag should be 0b0011.
            orders.workerpool.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000004'; // 0b0100
            // Match orders.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x06',
            );
        });

        it('[TEE] Should fail when the last bit of app tag does not satisfy dataset or request requirements', async () => {
            // The last bit of dataset and request tag is 1, but app tag does not set it
            orders.app.tag = '0x0000000000000000000000000000000000000000000000000000000000000002'; // 0b0010
            orders.dataset.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            orders.requester.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            // Set the workerpool tag in a way to pass first tag check.
            orders.workerpool.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            // Match orders.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x07',
            );
        });

        it('[TEE] Should fail when apps are different', async () => {
            orders.requester.app = randomAddress;
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x10',
            );
        });

        it('[TEE] Should fail when datasets are different', async () => {
            orders.requester.dataset = randomAddress;
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x11',
            );
        });

        it('[TEE] Should fail when request order workerpool mismatches workerpool order workerpool (EOA, SC)', async () => {
            orders.requester.workerpool = randomAddress;
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x12',
            );
            orders.requester.workerpool = randomContract.address;
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x12',
            );
        });

        /**
         * Failed match orders because of restriction mismatch (apprestrict,
         * datasetrestrict, workerpoolrestrict, requesterrestrict).
         */
        const revertMessages: { [key: string]: { [key: string]: string } } = {
            app: {
                dataset: 'iExecV5-matchOrders-0x13',
                workerpool: 'iExecV5-matchOrders-0x14',
                requester: 'iExecV5-matchOrders-0x15',
            },
            dataset: {
                app: 'iExecV5-matchOrders-0x16',
                workerpool: 'iExecV5-matchOrders-0x17',
                requester: 'iExecV5-matchOrders-0x18',
            },
            workerpool: {
                app: 'iExecV5-matchOrders-0x19',
                dataset: 'iExecV5-matchOrders-0x1a',
                requester: 'iExecV5-matchOrders-0x1b',
            },
        };
        // No restrictions in request order.
        ['app', 'dataset', 'workerpool'].forEach((orderName) => {
            ['app', 'dataset', 'workerpool', 'requester'].forEach((assetName) => {
                // Filter irrelevant cases (e.g. app - app).
                if (orderName.includes(assetName)) {
                    return;
                }
                it(`[TEE] Should fail when ${orderName} order mismatch ${assetName} restriction (EOA, SC)`, async function () {
                    const message = revertMessages[orderName][assetName];
                    // EOA
                    orders[orderName][assetName + 'restrict'] = randomAddress; // e.g. orders.app.datasetrestrict = 0xEOA
                    await expect(iexecPoco.matchOrders(...orders.toArray())).to.be.revertedWith(
                        message,
                    );
                    // SC
                    orders[orderName][assetName + 'restrict'] = randomContract.address; // e.g. orders.app.datasetrestrict = 0xSC
                    await expect(iexecPoco.matchOrders(...orders.toArray())).to.be.revertedWith(
                        message,
                    );
                });
            });
        });
    });

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
});
