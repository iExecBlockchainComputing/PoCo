// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { loadHardhatFixtureDeployment } from '../../../scripts/hardhat-fixture-deployer';
import {
    ERC1271Mock__factory,
    IERC721__factory,
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    IexecPocoAccessors__factory,
    OwnableMock,
    OwnableMock__factory,
} from '../../../typechain';
import { IexecPoco1 } from '../../../typechain/contracts/modules/interfaces/IexecPoco1.v8.sol';
import { IexecPoco1__factory } from '../../../typechain/factories/contracts/modules/interfaces/IexecPoco1.v8.sol';
import {
    IexecOrders,
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    hashOrder,
    signOrder,
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
const volume = 1;
const botVolume = 321;

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
    let [randomAddress, randomSignature]: string[] = [];
    let randomContract: OwnableMock;

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
        const randomWallet = ethers.Wallet.createRandom();
        randomAddress = randomWallet.address;
        randomSignature = await randomWallet.signMessage('random');
        randomContract = await new OwnableMock__factory()
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
                volume: botVolume,
                callback: randomAddress,
                trust: trust,
                category: category,
                params: params,
            });
            // Compute prices, stakes, rewards, ...
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                botVolume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                botVolume,
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
            ).to.equal(botVolume);

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
                .to.emit(iexecPoco, 'SchedulerNotice')
                .withArgs(workerpoolAddress, dealId)
                .to.emit(iexecPoco, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    botVolume,
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
            expect(deal.callback).to.equal(randomAddress);
            expect(deal.params).to.equal(params);
            expect(deal.startTime).to.equal(startTime);
            expect(deal.botFirst).to.equal(0);
            expect(deal.botSize).to.equal(botVolume);
            expect(deal.workerStake).to.equal(workerStakePerTask);
            expect(deal.schedulerRewardRatio).to.equal(schedulerRewardByTask);
            expect(deal.sponsor).to.equal(requester.address);
        });

        it('[Standard] Should match orders with all assets, beneficiary, BoT, callback, replication', async () => {
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
                volume: botVolume,
                callback: randomAddress,
                trust: trust,
                category: category,
                params: params,
            });
            await depositForRequesterAndSchedulerWithDefaultPrices(botVolume);
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
            expect(deal.callback).to.equal(randomAddress);
            expect(deal.params).to.equal(params);
            expect(deal.startTime).to.equal(startTime);
            expect(deal.botFirst).to.equal(0);
            expect(deal.botSize).to.equal(botVolume);
            expect(deal.workerStake).to.equal(
                await iexecWrapper.computeWorkerTaskStake(workerpoolAddress, workerpoolPrice),
            );
            expect(deal.schedulerRewardRatio).to.equal(
                await iexecWrapper.getSchedulerTaskRewardRatio(workerpoolAddress),
            );
            expect(deal.sponsor).to.equal(requester.address);
        });

        it('[TEE] Should match orders without beneficiary, BoT, callback, replication', async () => {
            await depositForRequesterAndSchedulerWithDefaultPrices(volume);
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

        it('[TEE] Should match orders without dataset', async () => {
            orders.dataset.dataset = AddressZero;
            orders.requester.dataset = AddressZero;
            // Set dataset volume lower than other assets to make sure
            // it does not impact final volume computation.
            orders.dataset.volume = botVolume - 1;
            orders.app.volume = botVolume;
            orders.workerpool.volume = botVolume;
            orders.requester.volume = botVolume;
            // Compute prices, stakes, rewards, ...
            const dealPrice = (appPrice + workerpoolPrice) * botVolume; // no dataset price
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                botVolume,
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
            expect(deal.botSize).to.equal(botVolume);
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

            await depositForRequesterAndSchedulerWithDefaultPrices(volume);
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
                    await depositForRequesterAndSchedulerWithDefaultPrices(volume);
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

        it('Should fail when app is not registered', async function () {
            orders.app.app = randomContract.address; // Must be an Ownable contract.
            orders.requester.app = randomContract.address;
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x20',
            );
        });

        it('Should fail when invalid app order signature from EOA', async function () {
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            orders.app.sign = randomSignature; // Override signature.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x21',
            );
        });

        it('Should fail when invalid app order signature from SC', async function () {
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            orders.app.sign = randomSignature; // Override signature.
            // Deploy an ERC1271 mock contract.
            const erc1271Contract = await new ERC1271Mock__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.deployed());
            // Transfer ownership of the app to the ERC1271 contract.
            await IERC721__factory.connect(await iexecPoco.appregistry(), appProvider)
                .transferFrom(
                    appProvider.address,
                    erc1271Contract.address,
                    appAddress, // tokenId
                )
                .then((tx) => tx.wait());
            // Make sure the test does not fail because of another reason.
            const signatureAddress = ethers.utils.verifyMessage(
                hashOrder(iexecWrapper.getDomain(), orders.app),
                orders.app.sign as any,
            );
            expect(signatureAddress).to.not.equal(erc1271Contract.address); // owner of app.
            // Match orders.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x21',
            );
        });

        it('Should fail when dataset is not registered', async function () {
            orders.dataset.dataset = randomContract.address; // Must be an Ownable contract.
            orders.requester.dataset = randomContract.address;
            await signOrder(iexecWrapper.getDomain(), orders.app, appProvider);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x30',
            );
        });

        it('Should fail when invalid dataset order signature from EOA', async function () {
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            orders.dataset.sign = randomSignature; // Override signature.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x31',
            );
        });

        it('Should fail when invalid dataset order signature from SC', async function () {
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            orders.dataset.sign = randomSignature; // Override signature.
            // Deploy an ERC1271 mock contract.
            const erc1271Contract = await new ERC1271Mock__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.deployed());
            // Transfer ownership of the dataset to the ERC1271 contract.
            await IERC721__factory.connect(await iexecPoco.datasetregistry(), datasetProvider)
                .transferFrom(
                    datasetProvider.address,
                    erc1271Contract.address,
                    datasetAddress, // tokenId
                )
                .then((tx) => tx.wait());
            // Make sure the test does not fail because of another reason.
            const signatureAddress = ethers.utils.verifyMessage(
                hashOrder(iexecWrapper.getDomain(), orders.dataset),
                orders.dataset.sign as any,
            );
            expect(signatureAddress).to.not.equal(erc1271Contract.address); // owner of dataset.
            // Match orders.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x31',
            );
        });

        it('Should fail when workerpool is not registered', async function () {
            orders.workerpool.workerpool = randomContract.address; // Must be an Ownable contract.
            orders.requester.workerpool = randomContract.address;
            await signOrder(iexecWrapper.getDomain(), orders.app, appProvider);
            await signOrder(iexecWrapper.getDomain(), orders.dataset, datasetProvider);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x40',
            );
        });

        it('Should fail when invalid workerpool order signature from EOA', async function () {
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            orders.workerpool.sign = randomSignature; // Override signature.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x41',
            );
        });

        it('Should fail when invalid workerpool order signature from SC', async function () {
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            orders.workerpool.sign = randomSignature; // Override signature.
            // Deploy an ERC1271 mock contract.
            const erc1271Contract = await new ERC1271Mock__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.deployed());
            // Transfer ownership of the workerpool to the ERC1271 contract.
            await IERC721__factory.connect(await iexecPoco.workerpoolregistry(), scheduler)
                .transferFrom(
                    scheduler.address,
                    erc1271Contract.address,
                    workerpoolAddress, // tokenId
                )
                .then((tx) => tx.wait());
            // Make sure the test does not fail because of another reason.
            const signatureAddress = ethers.utils.verifyMessage(
                hashOrder(iexecWrapper.getDomain(), orders.workerpool),
                orders.workerpool.sign as any,
            );
            expect(signatureAddress).to.not.equal(erc1271Contract.address); // owner of workerpool.
            // Match orders.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x41',
            );
        });

        it('Should fail when invalid request order signature from EOA', async function () {
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            orders.requester.sign = randomSignature; // Override signature.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x50',
            );
        });

        it('Should fail when invalid request order signature from SC', async function () {
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            orders.requester.sign = randomSignature; // Override signature.
            // Deploy an ERC1271 mock contract.
            const erc1271Contract = await new ERC1271Mock__factory()
                .connect(anyone)
                .deploy()
                .then((contract) => contract.deployed());
            // Set the smart contract as the requester.
            orders.requester.requester = erc1271Contract.address;
            // Make sure the test does not fail because of another reason.
            const signatureAddress = ethers.utils.verifyMessage(
                hashOrder(iexecWrapper.getDomain(), orders.requester),
                orders.requester.sign as any,
            );
            expect(signatureAddress).to.not.equal(erc1271Contract.address); // Requester.
            // Match orders.
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x50',
            );
        });

        it('Should fail if one or more orders are consumed', async function () {
            orders.app.volume = 0;
            // TODO Set order as consumed directly in storage using the following code.
            // Needs more debugging.
            //
            // const appOrderHash = iexecWrapper.hashOrder(orders.app);
            // const appOrderConsumedSlotIndex = ethers.utils.keccak256(
            //     ethers.utils.concat([
            //         appOrderHash, // key in the mapping.
            //         '0x12', // m_consumed mapping index.
            //     ])
            // );
            // // Set order as fully consumed.
            // await setStorageAt(
            //     iexecPoco.address,
            //     appOrderConsumedSlotIndex,
            //     ethers.utils.hexlify(Number(orders.app.volume)),
            // );
            await depositForRequesterAndSchedulerWithDefaultPrices(botVolume);
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'iExecV5-matchOrders-0x60',
            );
        });

        it('Should fail when requester has insufficient balance', async () => {
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            // Deposit less than deal price in the requester's account.
            await iexecWrapper.depositInIexecAccount(requester, dealPrice - 1);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            expect(await iexecPoco.balanceOf(requester.address)).to.be.lessThan(dealPrice);
            expect(await iexecPoco.balanceOf(scheduler.address)).to.equal(schedulerStake);
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'IexecEscrow: Transfer amount exceeds balance',
            );
        });

        it('Should fail when scheduler has insufficient balance', async () => {
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            // Deposit less than stake value in the scheduler's account.
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake - 1);
            expect(await iexecPoco.balanceOf(requester.address)).to.equal(dealPrice);
            expect(await iexecPoco.balanceOf(scheduler.address)).to.be.lessThan(schedulerStake);
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(iexecPocoAsRequester.matchOrders(...orders.toArray())).to.be.revertedWith(
                'IexecEscrow: Transfer amount exceeds balance',
            );
        });
    });

    describe.only('Sponsor match orders', () => {
        it('[TEE] Should sponsor match orders', async () => {
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

        it('Should fail when sponsor has insufficient balance', async () => {
            // Compute prices, stakes, rewards, ...
            const dealPrice =
                (appPrice + datasetPrice + workerpoolPrice) * // task price
                volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );
            // Deposit less than deal price in the sponsor's account.
            await iexecWrapper.depositInIexecAccount(sponsor, dealPrice - 1);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            // Sign and match orders.
            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
            await expect(
                iexecPocoAsSponsor.sponsorMatchOrders(...orders.toArray()),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });
    });

    /**
     * Helper function to deposit requester and scheduler stakes with
     * default prices for tests that do not rely on price changes.
     */
    async function depositForRequesterAndSchedulerWithDefaultPrices(volume: number) {
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
