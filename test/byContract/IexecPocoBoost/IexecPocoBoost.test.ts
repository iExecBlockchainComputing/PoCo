// SPDX-FileCopyrightText: 2023-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0
import { HashZero } from '@ethersproject/constants';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BytesLike, TypedDataDomain } from 'ethers';
import { ethers } from 'hardhat';
import {
    ERC1271Mock__factory,
    ERC734Mock,
    ERC734Mock__factory,
    GasWasterClient,
    GasWasterClient__factory,
    IERC721__factory,
    IOracleConsumer__factory,
    IexecAccessors,
    IexecAccessors__factory,
    IexecMaintenance,
    IexecMaintenance__factory,
    IexecOrderManagement__factory,
    IexecPoco2__factory,
    IexecPocoAccessors__factory,
    IexecPocoBoostAccessorsDelegate__factory,
    IexecPocoBoostDelegate,
    IexecPocoBoostDelegate__factory,
    OwnableMock__factory,
    TestClient,
    TestClient__factory,
} from '../../../typechain';
import * as constants from '../../../utils/constants';
import {
    IexecOrders,
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    createEmptyAppOrder,
    createEmptyDatasetOrder,
    createEmptyRequestOrder,
    createEmptyWorkerpoolOrder,
    createOrderOperation,
    hashOrder,
    signOrder,
    signOrders,
} from '../../../utils/createOrders';
import {
    OrderOperationEnum,
    TaskStatusEnum,
    buildAndSignContributionAuthorizationMessage,
    buildAndSignEnclaveMessage,
    buildResultCallbackAndDigest,
    buildUtf8ResultAndDigest,
    getDealId,
    getIexecAccounts,
    getTaskId,
    setNextBlockTimestamp,
} from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';

const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const taskIndex = 0n;
const volume = taskIndex + 1n;
const schedulerRewardRatio = 1n;
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const category = 0n;
const appPrice = 1000n;
const datasetPrice = 1_000_000n;
const workerpoolPrice = 1_000_000_000n;
const someSignature = '0xabcd'; // contract signatures could have arbitrary formats
const randomEOAAddress = ethers.Wallet.createRandom().address;

let proxyAddress: string;
let iexecPocoBoostInstance: IexecPocoBoostDelegate;
let iexecMaintenanceAsAdmin: IexecMaintenance;
let iexecAccessor: IexecAccessors;
let oracleConsumerInstance: TestClient;
let gasWasterClientInstance: GasWasterClient;
let gasWasterClientAddress: string;
let someContractAddress: string;
let iexecWrapper: IexecWrapper;
let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
let [
    requester,
    sponsor,
    beneficiary,
    appProvider,
    datasetProvider,
    scheduler,
    worker,
    enclave,
    anyone,
    sms,
]: SignerWithAddress[] = [];
let ordersActors: OrdersActors;
let ordersAssets: OrdersAssets;
let ordersPrices: OrdersPrices;
let domain: TypedDataDomain;
let workerpoolStakeRatio: bigint;
let kittyAddress: string;
let categoryTime: bigint;

describe('IexecPocoBoost', function () {
    beforeEach('Deploy', async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({
            requester,
            sponsor,
            beneficiary,
            appProvider,
            datasetProvider,
            scheduler,
            worker,
            enclave,
            anyone,
            sms,
        } = accounts);
        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        domain = iexecWrapper.getDomain();
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());
        iexecPocoBoostInstance = IexecPocoBoostDelegate__factory.connect(proxyAddress, anyone);
        iexecMaintenanceAsAdmin = IexecMaintenance__factory.connect(
            proxyAddress,
            accounts.iexecAdmin,
        );
        iexecAccessor = IexecAccessors__factory.connect(proxyAddress, ethers.provider);
        ordersActors = {
            appOwner: appProvider,
            datasetOwner: datasetProvider,
            workerpoolOwner: scheduler,
            requester: requester,
        };
        oracleConsumerInstance = await new TestClient__factory()
            .connect(anyone)
            .deploy()
            .then((contract) => contract.waitForDeployment());
        gasWasterClientInstance = await new GasWasterClient__factory()
            .connect(anyone)
            .deploy()
            .then((contract) => contract.waitForDeployment());
        gasWasterClientAddress = await gasWasterClientInstance.getAddress();
        someContractAddress = await new OwnableMock__factory()
            .connect(anyone)
            .deploy()
            .then((contract) => contract.waitForDeployment())
            .then((deployedContract) => deployedContract.getAddress()); // any other deployed contract would be fine
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
        workerpoolStakeRatio = await iexecAccessor.workerpool_stake_ratio();
        kittyAddress = await iexecAccessor.kitty_address();
        categoryTime = (await iexecAccessor.viewCategory(category)).workClockTimeRef;
    }

    describe('Match orders Boost', function () {
        it('Should match orders (TEE)', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
                prices: ordersPrices,
                callback: ethers.Wallet.createRandom().address,
            });
            const {
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requesterOrder: requestOrder,
            } = orders.toObject();
            // Should match orders with low app order volume
            // Set volumes
            appOrder.volume = 2n; // smallest unconsumed volume among all orders
            datasetOrder.volume = 3n;
            workerpoolOrder.volume = 4n;
            requestOrder.volume = 5n;
            const expectedVolume = 2n;
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * expectedVolume;
            const schedulerStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            const initialRequesterFrozen = await frozenOf(requester.address);
            const initialSchedulerFrozen = await frozenOf(scheduler.address);
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);
            await expectOrderConsumed(appOrderHash, 0n);
            await expectOrderConsumed(datasetOrderHash, 0n);
            await expectOrderConsumed(workerpoolOrderHash, 0n);
            await expectOrderConsumed(requestOrderHash, 0n);
            const startTime = await setNextBlockTimestamp();

            expect(
                await iexecPocoBoostInstance.matchOrdersBoost.staticCall(...orders.toArray()),
            ).to.equal(dealId);
            const matchOrdersBoostTx = iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray());
            await expect(matchOrdersBoostTx)
                .to.emit(iexecPocoBoostInstance, 'SchedulerNoticeBoost')
                .withArgs(
                    workerpoolAddress,
                    dealId,
                    appAddress,
                    datasetAddress,
                    requestOrder.category,
                    teeDealTag,
                    requestOrder.params,
                    beneficiary.address,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                )
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(requester.address, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(scheduler.address, proxyAddress, schedulerStake)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(scheduler.address, schedulerStake);
            await expectOrderConsumed(appOrderHash, expectedVolume);
            await expectOrderConsumed(datasetOrderHash, expectedVolume);
            await expectOrderConsumed(workerpoolOrderHash, expectedVolume);
            await expectOrderConsumed(requestOrderHash, expectedVolume);
            const deal = await viewDealBoost(dealId);
            // Check addresses.
            expect(deal.requester).to.be.equal(requestOrder.requester, 'Requester mismatch');
            expect(deal.appOwner).to.be.equal(appProvider.address, 'App owner mismatch');
            expect(deal.datasetOwner).to.be.equal(
                datasetProvider.address,
                'Dataset owner mismatch',
            );
            expect(deal.workerpoolOwner).to.be.equal(
                scheduler.address,
                'Workerpool owner mismatch',
            );
            expect(deal.workerReward).to.be.equal(
                (workerpoolPrice * // reward depends on
                    (100n - schedulerRewardRatio)) / // worker ratio
                    100n,
            );
            expect(deal.deadline).to.be.equal(
                startTime + // match order block timestamp
                    7n * // contribution deadline ratio
                        categoryTime, // requested category time reference
            );
            expect(deal.callback)
                .to.be.equal(requestOrder.callback, 'Callback mismatch')
                .to.not.be.equal(constants.NULL.ADDRESS);
            // Check prices.
            expect(deal.workerpoolPrice).to.be.equal(
                workerpoolOrder.workerpoolprice,
                'Workerpool price mismatch',
            );
            expect(deal.appPrice).to.be.equal(appOrder.appprice, 'App price mismatch');
            expect(deal.datasetPrice).to.be.equal(
                datasetOrder.datasetprice,
                'Dataset price mismatch',
            );
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
            expect(deal.shortTag).to.be.equal('0x000001');
            expect(deal.sponsor).to.be.equal(requestOrder.requester, 'Sponsor mismatch');

            // Check balances and frozens
            await expect(matchOrdersBoostTx).to.changeTokenBalances(
                iexecAccessor,
                [proxyAddress, requester.address, scheduler.address],
                [
                    dealPrice + schedulerStake, // Poco proxy
                    -dealPrice, // requester
                    -schedulerStake, // Scheduler
                ],
            );
            await expectFrozen(requester.address, initialRequesterFrozen + dealPrice);
            await expectFrozen(scheduler.address, initialSchedulerFrozen + schedulerStake);
        });

        it('Should sponsor match orders (TEE)', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
                prices: ordersPrices,
                callback: ethers.Wallet.createRandom().address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            // Should match orders with low app order volume
            // Set volumes
            appOrder.volume = 2n; // smallest unconsumed volume among all orders
            datasetOrder.volume = 3n;
            workerpoolOrder.volume = 4n;
            requestOrder.volume = 5n;
            const expectedVolume = 2n;
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * expectedVolume;
            const schedulerStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            await iexecWrapper.depositInIexecAccount(sponsor, dealPrice);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
            const initialRequesterFrozen = await frozenOf(requester.address);
            const initialSponsorFrozen = await frozenOf(sponsor.address);
            const initialSchedulerFrozen = await frozenOf(scheduler.address);
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);
            await expectOrderConsumed(appOrderHash, 0n);
            await expectOrderConsumed(datasetOrderHash, 0n);
            await expectOrderConsumed(workerpoolOrderHash, 0n);
            await expectOrderConsumed(requestOrderHash, 0n);
            const startTime = await setNextBlockTimestamp();

            expect(
                await iexecPocoBoostInstance
                    .connect(sponsor)
                    .sponsorMatchOrdersBoost.staticCall(...orders.toArray()),
            ).to.equal(dealId);
            expect(
                await IexecPocoAccessors__factory.connect(
                    proxyAddress,
                    ethers.provider,
                ).computeDealVolume.staticCall(...orders.toArray()),
            ).to.equal(expectedVolume);
            const sponsorMatchOrdersBoostTx = iexecPocoBoostInstance
                .connect(sponsor)
                .sponsorMatchOrdersBoost(...orders.toArray());
            await expect(sponsorMatchOrdersBoostTx)
                .to.emit(iexecPocoBoostInstance, 'SchedulerNoticeBoost')
                .withArgs(
                    workerpoolAddress,
                    dealId,
                    appAddress,
                    datasetAddress,
                    requestOrder.category,
                    teeDealTag,
                    requestOrder.params,
                    beneficiary.address,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                )
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(sponsor.address, proxyAddress, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(sponsor.address, dealPrice)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(scheduler.address, proxyAddress, schedulerStake)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(scheduler.address, schedulerStake)
                .to.emit(iexecPocoBoostInstance, 'DealSponsoredBoost')
                .withArgs(dealId, sponsor.address);
            await expectOrderConsumed(appOrderHash, expectedVolume);
            await expectOrderConsumed(datasetOrderHash, expectedVolume);
            await expectOrderConsumed(workerpoolOrderHash, expectedVolume);
            await expectOrderConsumed(requestOrderHash, expectedVolume);
            const deal = await viewDealBoost(dealId);
            // Check addresses.
            expect(deal.requester).to.be.equal(requestOrder.requester);
            expect(deal.appOwner).to.be.equal(appProvider.address);
            expect(deal.datasetOwner).to.be.equal(datasetProvider.address);
            expect(deal.workerpoolOwner).to.be.equal(scheduler.address);
            expect(deal.workerReward).to.be.equal(
                (workerpoolPrice * // reward depends on
                    (100n - schedulerRewardRatio)) / // worker ratio
                    100n,
            );
            expect(deal.deadline).to.be.equal(
                startTime + // match order block timestamp
                    7n * // contribution deadline ratio
                        categoryTime, // requested category time reference
            );
            expect(deal.callback)
                .to.be.equal(requestOrder.callback)
                .to.not.be.equal(constants.NULL.ADDRESS);
            // Check prices.
            expect(deal.workerpoolPrice).to.be.equal(workerpoolOrder.workerpoolprice);
            expect(deal.appPrice).to.be.equal(appOrder.appprice);
            expect(deal.datasetPrice).to.be.equal(datasetOrder.datasetprice);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
            expect(deal.shortTag).to.be.equal('0x000001');
            expect(deal.sponsor).to.be.equal(sponsor.address);

            // Check balances and frozens
            await expect(sponsorMatchOrdersBoostTx).to.changeTokenBalances(
                iexecAccessor,
                [proxyAddress, requester.address, sponsor.address, scheduler.address],
                [
                    dealPrice + schedulerStake, // Poco proxy
                    0, // requester
                    -dealPrice, // sponsor
                    -schedulerStake, // scheduler
                ],
            );
            await expectFrozen(requester.address, initialRequesterFrozen);
            await expectFrozen(sponsor.address, initialSponsorFrozen + dealPrice);
            await expectFrozen(scheduler.address, initialSchedulerFrozen + schedulerStake);
        });

        it('Should match orders with trust equals 1', async function () {
            // Build orders
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            // Change trust.
            requestOrder.trust = 1n;
            // Sign & hash orders.
            await signOrders(domain, orders, ordersActors);
            // Run & verify.
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.emit(iexecPocoBoostInstance, 'OrdersMatched');
        });

        it('Should match orders when assets and requester belongs to identity groups', async function () {
            let appOrder = createEmptyAppOrder();
            let datasetOrder = createEmptyDatasetOrder();
            let workerpoolOrder = createEmptyWorkerpoolOrder();
            let requestOrder = createEmptyRequestOrder();
            // App
            const appGroupIdentityInstance = await deployErc734MockContract();
            const appGroupIdentityAddress = await appGroupIdentityInstance.getAddress();
            appOrder.app = appAddress;
            datasetOrder.apprestrict = appGroupIdentityAddress;
            workerpoolOrder.apprestrict = appGroupIdentityAddress;
            requestOrder.app = appOrder.app;
            whenIdentityContractCalledForCandidateInGroupThenReturnTrue(
                appGroupIdentityInstance,
                appOrder.app,
            );
            // Dataset
            const datasetGroupIdentityInstance = await deployErc734MockContract();
            const datasetGroupIdentityAddress = await datasetGroupIdentityInstance.getAddress();
            datasetOrder.dataset = datasetAddress;
            appOrder.datasetrestrict = datasetGroupIdentityAddress;
            workerpoolOrder.datasetrestrict = datasetGroupIdentityAddress;
            requestOrder.dataset = datasetOrder.dataset;
            whenIdentityContractCalledForCandidateInGroupThenReturnTrue(
                datasetGroupIdentityInstance,
                datasetOrder.dataset,
            );
            // Workerpool
            const workerpoolGroupIdentityInstance = await deployErc734MockContract();
            const workerpoolGroupIdentityAddress =
                await workerpoolGroupIdentityInstance.getAddress();
            workerpoolOrder.workerpool = workerpoolAddress;
            appOrder.workerpoolrestrict = workerpoolGroupIdentityAddress;
            datasetOrder.workerpoolrestrict = workerpoolGroupIdentityAddress;
            requestOrder.workerpool = workerpoolGroupIdentityAddress;
            whenIdentityContractCalledForCandidateInGroupThenReturnTrue(
                workerpoolGroupIdentityInstance,
                workerpoolOrder.workerpool,
            );
            // Requester
            const requesterGroupIdentityInstance = await deployErc734MockContract();
            const requesterGroupIdentityAddress = await requesterGroupIdentityInstance.getAddress();
            requestOrder.requester = requester.address;
            appOrder.requesterrestrict = requesterGroupIdentityAddress;
            datasetOrder.requesterrestrict = requesterGroupIdentityAddress;
            workerpoolOrder.requesterrestrict = requesterGroupIdentityAddress;
            whenIdentityContractCalledForCandidateInGroupThenReturnTrue(
                requesterGroupIdentityInstance,
                requester.address,
            );
            // Finish orders setup
            appOrder.volume = volume;
            datasetOrder.volume = volume;
            workerpoolOrder.volume = volume;
            requestOrder.volume = volume;
            await signOrders(
                domain,
                new IexecOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
                ordersActors,
            );

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.emit(iexecPocoBoostInstance, 'OrdersMatched');
        });

        it('Should match orders if signers are smart contracts', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            }).toObject();
            const erc1271Address = await deployErc1271MockContract();
            await IERC721__factory.connect(await iexecAccessor.appregistry(), appProvider)
                .transferFrom(appProvider.address, erc1271Address, appAddress)
                .then((tx) => tx.wait());
            await IERC721__factory.connect(await iexecAccessor.datasetregistry(), datasetProvider)
                .transferFrom(datasetProvider.address, erc1271Address, datasetAddress)
                .then((tx) => tx.wait());
            await IERC721__factory.connect(await iexecAccessor.workerpoolregistry(), scheduler)
                .transferFrom(scheduler.address, erc1271Address, workerpoolAddress)
                .then((tx) => tx.wait());
            requestOrder.requester = erc1271Address;
            const sign = ethers.id('valid-signature');
            appOrder.sign = sign;
            datasetOrder.sign = sign;
            workerpoolOrder.sign = sign;
            requestOrder.sign = sign;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.emit(iexecPocoBoostInstance, 'OrdersMatched');
        });

        it('Should match orders with pre-signatures (TEE)', async function () {
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                beneficiary: beneficiary.address,
                tag: teeDealTag,
            }).toObject();
            const iexecOrderManagement = IexecOrderManagement__factory.connect(
                proxyAddress,
                ethers.provider,
            );
            await iexecOrderManagement
                .connect(appProvider)
                .manageAppOrder(createOrderOperation(appOrder, OrderOperationEnum.SIGN))
                .then((tx) => tx.wait());
            await iexecOrderManagement
                .connect(datasetProvider)
                .manageDatasetOrder(createOrderOperation(datasetOrder, OrderOperationEnum.SIGN))
                .then((tx) => tx.wait());
            await iexecOrderManagement
                .connect(scheduler)
                .manageWorkerpoolOrder(
                    createOrderOperation(workerpoolOrder, OrderOperationEnum.SIGN),
                )
                .then((tx) => tx.wait());
            await iexecOrderManagement
                .connect(requester)
                .manageRequestOrder(createOrderOperation(requestOrder, OrderOperationEnum.SIGN))
                .then((tx) => tx.wait());
            const dealId = getDealId(domain, requestOrder, taskIndex);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'SchedulerNoticeBoost')
                .withArgs(
                    workerpoolAddress,
                    dealId,
                    appAddress,
                    datasetAddress,
                    requestOrder.category,
                    teeDealTag,
                    requestOrder.params,
                    beneficiary.address,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    hashOrder(domain, appOrder),
                    hashOrder(domain, datasetOrder),
                    hashOrder(domain, workerpoolOrder),
                    hashOrder(domain, requestOrder),
                    volume,
                );
        });

        it('Should match orders without dataset (TEE)', async function () {
            const dealPrice = (appPrice + workerpoolPrice) * volume;
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            await iexecWrapper.depositInIexecAccount(
                scheduler,
                computeSchedulerDealStake(workerpoolPrice, volume),
            );
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = buildOrders({
                assets: {
                    app: appAddress,
                    dataset: constants.NULL.ADDRESS, // No dataset.
                    workerpool: workerpoolAddress,
                },
                requester: requester.address,
                beneficiary: beneficiary.address,
                prices: {
                    app: appPrice,
                    dataset: 0n,
                    workerpool: workerpoolPrice,
                },
                tag: teeDealTag,
            }).toObject();
            await signOrder(domain, appOrder, appProvider);
            await signOrder(domain, workerpoolOrder, scheduler);
            await signOrder(domain, requestOrder, requester);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const emptyDatasetOrderHash = hashOrder(domain, datasetOrder);
            await expectOrderConsumed(emptyDatasetOrderHash, 0n);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'SchedulerNoticeBoost')
                .withArgs(
                    workerpoolAddress,
                    dealId,
                    appAddress,
                    constants.NULL.ADDRESS, // No dataset.
                    requestOrder.category,
                    teeDealTag,
                    requestOrder.params,
                    beneficiary.address,
                )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    hashOrder(domain, appOrder),
                    constants.NULL.BYTES32,
                    hashOrder(domain, workerpoolOrder),
                    hashOrder(domain, requestOrder),
                    volume,
                );
            await expectOrderConsumed(emptyDatasetOrderHash, 0n);
            const deal = await viewDealBoost(dealId);
            expect(deal.datasetPrice).to.be.equal(0);
        });

        it('Should match orders with low workerpool order volume', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            // Set volumes
            appOrder.volume = 5n;
            datasetOrder.volume = 4n;
            workerpoolOrder.volume = 3n; // smallest unconsumed volume among all orders
            requestOrder.volume = 6n;
            const expectedVolume = 3n;
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                );
            await expectOrderConsumed(appOrderHash, expectedVolume);
            await expectOrderConsumed(datasetOrderHash, expectedVolume);
            await expectOrderConsumed(workerpoolOrderHash, expectedVolume);
            await expectOrderConsumed(requestOrderHash, expectedVolume);
            const deal = await viewDealBoost(dealId);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
        });

        it('Should match orders with low request order volume', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            // Set volumes
            appOrder.volume = 7n;
            datasetOrder.volume = 6n;
            workerpoolOrder.volume = 5n;
            requestOrder.volume = 4n; // smallest unconsumed volume among all orders
            const expectedVolume = 4n;
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                );
            await expectOrderConsumed(appOrderHash, expectedVolume);
            await expectOrderConsumed(datasetOrderHash, expectedVolume);
            await expectOrderConsumed(workerpoolOrderHash, expectedVolume);
            await expectOrderConsumed(requestOrderHash, expectedVolume);
            const deal = await viewDealBoost(dealId);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
        });

        it('Should match orders with low dataset order volume', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            // Set volumes
            appOrder.volume = 6n;
            datasetOrder.volume = 5n; // smallest unconsumed volume among all orders
            workerpoolOrder.volume = 7n;
            requestOrder.volume = 8n;
            const expectedVolume = 5n;
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    expectedVolume,
                );
            await expectOrderConsumed(appOrderHash, expectedVolume);
            await expectOrderConsumed(datasetOrderHash, expectedVolume);
            await expectOrderConsumed(workerpoolOrderHash, expectedVolume);
            await expectOrderConsumed(requestOrderHash, expectedVolume);
            const deal = await viewDealBoost(dealId);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(expectedVolume);
        });

        it('Should match request order multiple times until fully consumed', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            const { appOrder, datasetOrder, workerpoolOrder, requestOrder } = orders.toObject();
            appOrder.volume = 8n;
            datasetOrder.volume = 8n;
            const requestOrderVolume = 8n;
            requestOrder.volume = requestOrderVolume;
            // Partially consume orders in a first batch
            workerpoolOrder.volume = 3; // 3 now and 5 later
            await signOrders(domain, orders, ordersActors);
            const dealId1 = getDealId(domain, requestOrder, taskIndex);
            const appOrderHash = hashOrder(domain, appOrder);
            const datasetOrderHash = hashOrder(domain, datasetOrder);
            const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
            const requestOrderHash = hashOrder(domain, requestOrder);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId1,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    3,
                );
            const deal = await viewDealBoost(dealId1);
            expect(deal.botFirst).to.be.equal(0);
            expect(deal.botSize).to.be.equal(3);

            // Fully consume orders in a second and last batch
            const workerpoolOrder2 = workerpoolOrder;
            workerpoolOrder2.volume = 5n;
            const workerpoolOrderHash2 = hashOrder(domain, workerpoolOrder2);
            await signOrder(domain, workerpoolOrder2, scheduler);
            const dealId2 = getDealId(domain, requestOrder, 3n);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder2,
                    requestOrder,
                ),
            )
                .to.emit(iexecPocoBoostInstance, 'OrdersMatched')
                .withArgs(
                    dealId2,
                    appOrderHash,
                    datasetOrderHash,
                    workerpoolOrderHash2,
                    requestOrderHash,
                    5,
                );
            const deal2 = await viewDealBoost(dealId2);
            expect(deal2.botFirst).to.be.equal(3); // next index after last task of deal1:{0, 1, 2}
            expect(deal2.botSize).to.be.equal(5);
            // Verify request is fully consumed
            await expectOrderConsumed(requestOrderHash, requestOrderVolume);
        });

        it('Should fail when trust is greater than 1', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Set bad trust (> 1).
            orders.requester.trust = 2n;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Bad trust level');
        });

        it('Should fail when categories are different', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Set different categories
            orders.requester.category = 1;
            orders.workerpool.category = 2;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Category mismatch');
        });

        it('Should fail when category unknown', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Unknown category
            orders.requester.category = 5;
            orders.workerpool.category = 5;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Unknown category');
        });

        it('Should fail when app max price is less than app price', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            orders.app.appprice = 200n;
            orders.requester.appmaxprice = 100n;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Overpriced app');
        });

        it('Should fail when dataset max price is less than dataset price', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Set dataset price higher than dataset max price
            orders.dataset.datasetprice = 300n;
            orders.requester.datasetmaxprice = 200n;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Overpriced dataset');
        });

        it('Should fail when workerpool max price is less than workerpool price', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Set workerpool price higher than workerpool max price
            orders.workerpool.workerpoolprice = 400n;
            orders.requester.workerpoolmaxprice = 300n;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Overpriced workerpool');
        });

        it('Should fail when workerpool tag does not satisfy app, dataset and request requirements', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            // Manually set the tags for app, dataset, and request orders
            orders.app.tag = '0x0000000000000000000000000000000000000000000000000000000000000001'; // 0b0001
            orders.dataset.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000002'; // 0b0010
            orders.requester.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            // Set the workerpool tag to a different value
            orders.workerpool.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000004'; // 0b0100
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Workerpool tag does not match demand');
        });

        it('Should fail when the last bit of app tag does not satisfy dataset or request requirements', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            // Manually set the tags for app, dataset, and request orders
            // The last bit of dataset and request tag is 1, but app tag does not set it
            orders.app.tag = '0x0000000000000000000000000000000000000000000000000000000000000002'; // 0b0010
            orders.dataset.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            orders.requester.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            // Set the workerpool tag to pass first tag check
            orders.workerpool.tag =
                '0x0000000000000000000000000000000000000000000000000000000000000003'; // 0b0011
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: App tag does not match demand');
        });

        it('Should fail when app are different', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Request another app address
            orders.requester.app = '0x0000000000000000000000000000000000000001';
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: App mismatch');
        });

        it('Should fail when dataset are different', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Request another dataset address
            orders.requester.dataset = '0x0000000000000000000000000000000000000001';
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Dataset mismatch');
        });

        it('Should fail when request order workerpool mismatches workerpool order workerpool (EOA, SC)', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // EOA
            orders.requester.workerpool = randomEOAAddress;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Workerpool restricted by request order');
            // SC
            orders.requester.workerpool = someContractAddress;
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Workerpool restricted by request order');
        });

        /**
         * Dynamically generated tests for all different restrictions in orders
         * (requesterrestrict, apprestrict, workerpoolrestrict, datasetrestrict).
         */
        ['app', 'workerpool', 'dataset'].forEach((orderName) => {
            // No request order
            ['requester', 'app', 'workerpool', 'dataset'].forEach((assetName) => {
                // Filter irrelevant cases. E.g. no need to change the app address in the app order.
                if (orderName.includes(assetName)) {
                    return;
                }
                it(`Should fail when ${orderName} order mismatch ${assetName} restriction (EOA, SC)`, async function () {
                    const capitalizedAssetName =
                        assetName.charAt(0).toUpperCase() + assetName.substring(1); // app => App
                    const revertMessage = `PocoBoost: ${capitalizedAssetName} restricted by ${orderName} order`;
                    const orders = buildOrders({
                        assets: ordersAssets,
                        requester: requester.address,
                    });
                    // EOA
                    // E.g. changes orders['app']['apprestrict'] = 0xAddress
                    // @ts-ignore
                    orders[orderName][assetName + 'restrict'] = randomEOAAddress;
                    await expect(
                        iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
                    ).to.be.revertedWith(revertMessage);
                    // SC
                    // @ts-ignore
                    orders[orderName][assetName + 'restrict'] = someContractAddress;
                    await expect(
                        iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
                    ).to.be.revertedWith(revertMessage);
                });
            });
        });

        it('Should fail when app not registered', async function () {
            const orders = buildOrders({
                assets: {
                    app: someContractAddress,
                    dataset: datasetAddress,
                    workerpool: workerpoolAddress,
                },
                requester: requester.address,
            });
            await signOrder(domain, orders.app, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: App not registered');
        });

        it('Should fail when invalid app order signature from EOA', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid app order signature');
        });

        it('Should fail when invalid app order signature from contract', async function () {
            const erc1271Address = await deployErc1271MockContract();
            await IERC721__factory.connect(await iexecAccessor.appregistry(), appProvider)
                .transferFrom(appProvider.address, erc1271Address, appAddress)
                .then((tx) => tx.wait());
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            orders.app.sign = someSignature;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid app order signature');
        });

        it('Should fail when dataset not registered', async function () {
            const orders = buildOrders({
                assets: {
                    app: appAddress,
                    dataset: someContractAddress,
                    workerpool: workerpoolAddress,
                },
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Dataset not registered');
        });

        it('Should fail when invalid dataset order signature from EOA', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, appProvider);
            await signOrder(domain, orders.dataset, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid dataset order signature');
        });

        it('Should fail when invalid dataset order signature from contract', async function () {
            const erc1271Address = await deployErc1271MockContract();
            await IERC721__factory.connect(await iexecAccessor.datasetregistry(), datasetProvider)
                .transferFrom(datasetProvider.address, erc1271Address, datasetAddress)
                .then((tx) => tx.wait());
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, appProvider);
            orders.dataset.sign = someSignature;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid dataset order signature');
        });

        it('Should fail when workerpool not registered', async function () {
            const orders = buildOrders({
                assets: {
                    app: appAddress,
                    dataset: datasetAddress,
                    workerpool: someContractAddress,
                },
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Workerpool not registered');
        });

        it('Should fail when invalid workerpool order signature from EOA', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, appProvider);
            await signOrder(domain, orders.dataset, datasetProvider);
            await signOrder(domain, orders.workerpool, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid workerpool order signature');
        });

        it('Should fail when invalid workerpool order signature from contract', async function () {
            const erc1271Address = await deployErc1271MockContract();
            await IERC721__factory.connect(await iexecAccessor.workerpoolregistry(), scheduler)
                .transferFrom(scheduler.address, erc1271Address, workerpoolAddress)
                .then((tx) => tx.wait());
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, appProvider);
            await signOrder(domain, orders.dataset, datasetProvider);
            orders.workerpool.sign = someSignature;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid workerpool order signature');
        });

        it('Should fail when invalid request order signature from EOA', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrder(domain, orders.app, appProvider);
            await signOrder(domain, orders.dataset, datasetProvider);
            await signOrder(domain, orders.workerpool, scheduler);
            await signOrder(domain, orders.requester, anyone);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid request order signature');
        });

        it('Should fail when invalid request order signature from contract', async function () {
            const erc1271Address = await deployErc1271MockContract();
            const orders = buildOrders({
                assets: ordersAssets,
                requester: erc1271Address,
            });
            await signOrder(domain, orders.app, appProvider);
            await signOrder(domain, orders.dataset, datasetProvider);
            await signOrder(domain, orders.workerpool, scheduler);
            orders.requester.sign = someSignature;

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: Invalid request order signature');
        });

        it('Should fail if one or more orders are consumed', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            // Set volumes
            orders.app.volume = 0; // nothing to consume
            await signOrders(domain, orders, ordersActors);

            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('PocoBoost: One or more orders consumed');
        });

        it('Should fail when requester has insufficient balance', async () => {
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
            });

            const initialRequesterBalance = 2n;
            await iexecWrapper.depositInIexecAccount(requester, initialRequesterBalance);
            expect(await iexecAccessor.balanceOf(requester.address)).to.be.lessThan(dealPrice);

            await signOrders(domain, orders, ordersActors);
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });

        it('Should fail when scheduler has insufficient balance', async () => {
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = computeSchedulerDealStake(workerpoolPrice, volume);
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
            });

            const initialRequesterBalance = 2n;
            const initialSchedulerBalance = 3n; // Way less than what is needed as stake.
            await iexecWrapper.depositInIexecAccount(
                requester,
                initialRequesterBalance + dealPrice,
            );
            await iexecWrapper.depositInIexecAccount(scheduler, initialSchedulerBalance);
            // Make sure the tx does not fail because of requester's balance.
            expect(await iexecAccessor.balanceOf(requester.address)).to.be.greaterThan(dealPrice);
            // Make sure the scheduler does not have enough to stake.
            expect(await iexecAccessor.balanceOf(scheduler.address)).to.be.lessThan(schedulerStake);

            await signOrders(domain, orders, ordersActors);
            await expect(
                iexecPocoBoostInstance.matchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });
        it('Should fail when sponsor has insufficient balance', async () => {
            const dealPrice = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
            });

            const initialSponsorBalance = 2n;
            await iexecWrapper.depositInIexecAccount(sponsor, initialSponsorBalance);
            expect(await iexecAccessor.balanceOf(sponsor.address)).to.be.lessThan(dealPrice);

            await signOrders(domain, orders, ordersActors);
            await expect(
                iexecPocoBoostInstance
                    .connect(sponsor)
                    .sponsorMatchOrdersBoost(...orders.toArray()),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });
    });

    describe('Push Result Boost', function () {
        it('Should push result (TEE & callback)', async function () {
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const volume = 3n;
            const dealPrice = taskPrice * volume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                prices: ordersPrices,
                volume: volume,
                callback: await oracleConsumerInstance.getAddress(),
            });
            const initialKitty = 10_000_000_010n; // MIN_KITTY * 10 + 10,
            // Fill kitty
            const kittyFillingDeal = await iexecWrapper.signAndSponsorMatchOrders(
                ...buildOrders({
                    assets: ordersAssets,
                    requester: requester.address,
                    prices: {
                        app: 0n,
                        dataset: 0n,
                        workerpool: 33_333_333_367n, // 30% will go to kitty
                    },
                }).toArray(),
            );
            await time.setNextBlockTimestamp(
                (await iexecAccessor.viewDeal(kittyFillingDeal.dealId)).startTime +
                    10n * categoryTime,
            );
            await IexecPoco2__factory.connect(proxyAddress, anyone)
                .initializeAndClaimArray([kittyFillingDeal.dealId], [kittyFillingDeal.taskIndex])
                .then((tx) => tx.wait());
            expect(await frozenOf(kittyAddress)).to.equal(initialKitty);
            // Previous deal for filling kitty is completed, now preparing main deal
            const schedulerDealStake = computeSchedulerDealStake(workerpoolPrice, volume);
            const schedulerTaskStake = schedulerDealStake / volume;
            // Setup: MIN_REWARD < reward < available
            // Further assertion on scheduler kitty reward will fail if the
            // KITTY_RATIO constant is someday updated in the source code.
            const expectedSchedulerKittyRewardForTask1 =
                (initialKitty * // total kitty
                    10n) / // KITTY_RATIO
                100n; // percentage
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerDealStake);
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const initialRequesterFrozen = await frozenOf(requester.address);
            const initialSchedulerFrozen = await frozenOf(scheduler.address);
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                enclave.address,
                scheduler,
            );
            const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);
            const enclaveSignature = await buildAndSignEnclaveMessage(
                worker.address,
                taskId,
                callbackResultDigest,
                enclave,
            );
            await time.setNextBlockTimestamp(
                startTime +
                    7n * categoryTime - // deadline
                    1n, // push result 1 second before deadline
            );
            const expectedWorkerReward = (await viewDealBoost(dealId)).workerReward;
            // Worker reward formula already checked in match orders test, hence
            // we just need to verify here that some worker reward value will be
            // transferred
            expect(expectedWorkerReward).to.be.greaterThan(0);
            const expectedSchedulerBaseReward = workerpoolPrice - expectedWorkerReward;
            const expectedSchedulerFullReward =
                expectedSchedulerBaseReward + expectedSchedulerKittyRewardForTask1;

            const pushResultBoostTx = iexecPocoBoostInstance
                .connect(worker)
                .pushResultBoost(
                    dealId,
                    taskIndex,
                    results,
                    resultsCallback,
                    schedulerSignature,
                    enclave.address,
                    enclaveSignature,
                );
            await expect(pushResultBoostTx)
                .to.emit(iexecPocoBoostInstance, 'Seize')
                .withArgs(requester.address, taskPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, worker.address, expectedWorkerReward)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(worker.address, expectedWorkerReward, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, appProvider.address, appPrice)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(appProvider.address, appPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, datasetProvider.address, datasetPrice)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(datasetProvider.address, datasetPrice, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, scheduler.address, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'Unlock')
                .withArgs(scheduler.address, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'Seize')
                .withArgs(kittyAddress, expectedSchedulerKittyRewardForTask1, taskId)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, scheduler.address, expectedSchedulerFullReward)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(scheduler.address, expectedSchedulerFullReward, taskId)
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
            // Check task status
            const task = await iexecAccessor.viewTask(taskId);
            expect(task.status).to.equal(TaskStatusEnum.COMPLETED);
            expect(task.dealid).to.equal(HashZero);
            expect(task.idx).to.equal(0);
            expect(task.timeref).to.equal(0);
            expect(task.contributionDeadline).to.equal(0);
            expect(task.revealDeadline).to.equal(0);
            expect(task.finalDeadline).to.equal(0);
            expect(task.consensusValue).to.equal(HashZero);
            expect(task.revealCounter).to.equal(0);
            expect(task.winnerCounter).to.equal(0);
            expect(task.contributors.length).to.equal(0);
            expect(task.resultDigest).to.equal(HashZero);
            expect(task.results).to.equal('0x');
            expect(task.resultsTimestamp).to.equal(0);
            expect(task.resultsCallback).to.equal('0x');
            // Check balances and frozens
            await expect(pushResultBoostTx).to.changeTokenBalances(
                iexecAccessor,
                [
                    proxyAddress,
                    requester.address,
                    worker.address,
                    scheduler.address,
                    appProvider.address,
                    datasetProvider.address,
                ],
                [
                    -(
                        0n +
                        expectedWorkerReward +
                        schedulerTaskStake +
                        expectedSchedulerFullReward +
                        appPrice +
                        datasetPrice
                    ), // PoCo proxy
                    0, // requester
                    expectedWorkerReward, // worker
                    schedulerTaskStake + expectedSchedulerFullReward, // scheduler
                    appPrice, // app provider
                    datasetPrice, // dataset provider
                ],
            );
            await expectFrozen(requester.address, initialRequesterFrozen - taskPrice);
            await expectFrozen(scheduler.address, initialSchedulerFrozen - schedulerTaskStake);
            await expectFrozen(kittyAddress, initialKitty - expectedSchedulerKittyRewardForTask1);
        });

        it('Should push result (TEE with contribution authorization signed by scheduler)', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                enclave.address,
                scheduler,
            );
            const enclaveSignature = await buildAndSignEnclaveMessage(
                worker.address,
                taskId,
                resultDigest,
                enclave,
            );

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        enclave.address,
                        enclaveSignature,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
        });

        it('Should push result (TEE with contribution authorization signed by broker)', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            await iexecMaintenanceAsAdmin.setTeeBroker(sms.address).then((tx) => tx.wait());

            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const teeBrokerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                enclave.address,
                sms,
            );
            const enclaveSignature = await buildAndSignEnclaveMessage(
                worker.address,
                taskId,
                resultDigest,
                enclave,
            );

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        teeBrokerSignature,
                        enclave.address,
                        enclaveSignature,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
        });

        it('Should push result', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const emptyEnclaveAddress = constants.NULL.ADDRESS;
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                emptyEnclaveAddress,
                scheduler,
            );

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        emptyEnclaveAddress,
                        constants.NULL.SIGNATURE,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                .withArgs(dealId, taskIndex, results);
        });

        it('Should push result even if callback target is not a contract', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                callback: ethers.Wallet.createRandom().address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const resultsCallback = '0xab';

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        resultsCallback,
                        await buildAndSignContributionAuthorizationMessage(
                            worker.address,
                            taskId,
                            enclave.address,
                            scheduler,
                        ),
                        enclave.address,
                        await buildAndSignEnclaveMessage(
                            worker.address,
                            taskId,
                            ethers.keccak256(resultsCallback),
                            enclave,
                        ),
                    ),
            ).to.emit(iexecPocoBoostInstance, 'ResultPushedBoost');
        });

        it('Should push result even if callback reverts', async function () {
            const revertingOracleConsumer = IOracleConsumer__factory.connect(
                someContractAddress,
                anyone,
            );
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                callback: await revertingOracleConsumer.getAddress(), // will revert
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const resultsCallback = '0xab';
            // Check that the oracle consumer would revert
            await expect(
                revertingOracleConsumer.receiveResult(taskId, resultsCallback),
            ).to.be.revertedWithoutReason();

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        resultsCallback,
                        await buildAndSignContributionAuthorizationMessage(
                            worker.address,
                            taskId,
                            enclave.address,
                            scheduler,
                        ),
                        enclave.address,
                        await buildAndSignEnclaveMessage(
                            worker.address,
                            taskId,
                            ethers.keccak256(resultsCallback),
                            enclave,
                        ),
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                /**
                 * Oracle consumer has been called but did not succeed.
                 */
                .to.not.emit(oracleConsumerInstance, 'GotResult');
        });

        it('Should push result even if callback consumes maximum gas', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                callback: gasWasterClientAddress,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const { resultsCallback } = buildResultCallbackAndDigest(123);
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                constants.NULL.ADDRESS,
                scheduler,
            );

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        resultsCallback,
                        schedulerSignature,
                        constants.NULL.ADDRESS,
                        constants.NULL.SIGNATURE,
                    ),
            )
                .to.emit(iexecPocoBoostInstance, 'ResultPushedBoost')
                /**
                 * Gas waster client has been called but run out-of-gas.
                 */
                .to.not.emit(gasWasterClientInstance, 'GotResult');
        });

        it('Should not push result if wrong deal ID', async function () {
            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        '0x00000000000000000000000000000000000000000000000000000000fac6dea1',
                        taskIndex,
                        '0x',
                        constants.NULL.BYTES32,
                        constants.NULL.SIGNATURE,
                        constants.NULL.ADDRESS,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Unknown task');
        });

        it('Should not push result if out-of-range task index', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());

            await expect(
                iexecPocoBoostInstance.connect(worker).pushResultBoost(
                    dealId, // existing deal
                    1, // only task index 0 would be authorized with this deal volume of 1
                    '0x',
                    constants.NULL.BYTES32,
                    constants.NULL.SIGNATURE,
                    constants.NULL.ADDRESS,
                    constants.NULL.SIGNATURE,
                ),
            ).to.be.revertedWith('PocoBoost: Unknown task');
        });

        it('Should not push result twice', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const emptyEnclaveAddress = constants.NULL.ADDRESS;
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                emptyEnclaveAddress,
                scheduler,
            );
            const pushResultBoost: () => Promise<any> = () =>
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        emptyEnclaveAddress,
                        constants.NULL.SIGNATURE,
                    );

            // Push result
            await expect(pushResultBoost()).to.emit(iexecPocoBoostInstance, 'ResultPushedBoost');
            // Push result a second time
            await expect(pushResultBoost()).to.be.revertedWith('PocoBoost: Task status not unset');
        });

        it('Should not push result after deadline', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            await time.setNextBlockTimestamp(startTime + 7n * categoryTime); // push result on deadline

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        getDealId(domain, orders.requester, taskIndex),
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        constants.NULL.SIGNATURE,
                        enclave.address,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Deadline reached');
        });

        it('Should not push result without enclave challenge for TEE task', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        constants.NULL.SIGNATURE,
                        constants.NULL.ADDRESS,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Tag requires enclave challenge');
        });

        it('Should not push result with invalid scheduler signature', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const anyoneSignature = await anyone.signMessage(constants.NULL.BYTES32);

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        getDealId(domain, orders.requester, taskIndex),
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        anyoneSignature,
                        enclave.address,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Invalid contribution authorization signature');
        });

        it('Should not push result with invalid broker signature', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await iexecMaintenanceAsAdmin.setTeeBroker(sms.address).then((tx) => tx.wait());

            await signOrders(domain, orders, ordersActors);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const anyoneSignature = await anyone.signMessage(constants.NULL.BYTES32);

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        getDealId(domain, orders.requester, taskIndex),
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        anyoneSignature,
                        enclave.address,
                        constants.NULL.SIGNATURE,
                    ),
            ).to.be.revertedWith('PocoBoost: Invalid contribution authorization signature');
        });

        it('Should not push result with invalid enclave signature', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
            });

            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                getTaskId(dealId, taskIndex),
                enclave.address,
                scheduler,
            );
            const anyoneSignature = await anyone.signMessage(constants.NULL.BYTES32);

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        constants.NULL.BYTES32,
                        schedulerSignature,
                        enclave.address,
                        anyoneSignature,
                    ),
            ).to.be.revertedWith('PocoBoost: Invalid enclave signature');
        });

        it('Should not push result with missing data for callback', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                tag: teeDealTag,
                callback: ethers.Wallet.createRandom().address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                enclave.address,
                scheduler,
            );
            const resultsCallback = '0x';
            const enclaveSignature = await buildAndSignEnclaveMessage(
                worker.address,
                taskId,
                ethers.keccak256(resultsCallback),
                enclave,
            );

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(
                        dealId,
                        taskIndex,
                        results,
                        resultsCallback,
                        schedulerSignature,
                        enclave.address,
                        enclaveSignature,
                    ),
            ).to.be.revertedWith('PocoBoost: Callback requires data');
        });

        it('Should not push result without enough gas for callback', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                callback: gasWasterClientAddress,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const { resultsCallback } = buildResultCallbackAndDigest(123);
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                constants.NULL.ADDRESS,
                scheduler,
            );
            const pushResultArgs = [
                dealId,
                taskIndex,
                results,
                resultsCallback,
                schedulerSignature,
                constants.NULL.ADDRESS,
                constants.NULL.SIGNATURE,
            ] as [BytesLike, bigint, BytesLike, BytesLike, BytesLike, string, BytesLike];
            const successfulTxGasLimit = await iexecPocoBoostInstance
                .connect(worker)
                .pushResultBoost.estimateGas(...pushResultArgs);
            const failingTxGaslimit =
                successfulTxGasLimit - (await iexecAccessor.callbackgas()) / 63n;
            // Forward to consumer contract less gas than it has the right to consume

            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .pushResultBoost(...pushResultArgs, { gasLimit: failingTxGaslimit }),
            ).to.be.revertedWithoutReason(); // TODO: Check 'PocoBoost: Not enough gas after callback'
        });
    });

    describe('Claim task Boost', function () {
        it('Should claim', async function () {
            const expectedVolume = 3n; // > 1 to explicit taskPrice vs dealPrice
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * expectedVolume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume: expectedVolume,
            });
            await signOrders(domain, orders, ordersActors);
            const schedulerDealStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            const schedulerTaskStake = schedulerDealStake / expectedVolume;
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerDealStake);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const initialRequesterFrozen = await frozenOf(requester.address);
            const initialSchedulerFrozen = await frozenOf(scheduler.address);
            const initialKittyFrozen = await frozenOf(kittyAddress);
            await time.setNextBlockTimestamp(startTime + 7n * categoryTime); // claim on deadline

            const claimBoostTx = await iexecPocoBoostInstance
                .connect(worker)
                .claimBoost(dealId, taskIndex);
            await expect(claimBoostTx)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, requester.address, taskPrice)
                .to.emit(iexecPocoBoostInstance, 'Unlock')
                .withArgs(requester.address, taskPrice)
                .to.emit(iexecPocoBoostInstance, 'Seize')
                .withArgs(scheduler.address, schedulerTaskStake, taskId)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(kittyAddress, schedulerTaskStake, taskId)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(kittyAddress, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'TaskClaimed')
                .withArgs(taskId);
            // Check task status
            const task = await iexecAccessor.viewTask(taskId);
            expect(task.status).to.equal(TaskStatusEnum.FAILED);
            expect(task.dealid).to.equal(HashZero);
            expect(task.idx).to.equal(0);
            expect(task.timeref).to.equal(0);
            expect(task.contributionDeadline).to.equal(0);
            expect(task.revealDeadline).to.equal(0);
            expect(task.finalDeadline).to.equal(0);
            expect(task.consensusValue).to.equal(HashZero);
            expect(task.revealCounter).to.equal(0);
            expect(task.winnerCounter).to.equal(0);
            expect(task.contributors.length).to.equal(0);
            expect(task.resultDigest).to.equal(HashZero);
            expect(task.results).to.equal('0x');
            expect(task.resultsTimestamp).to.equal(0);
            expect(task.resultsCallback).to.equal('0x');
            // Check balances and frozens
            await expect(claimBoostTx).to.changeTokenBalances(
                iexecAccessor,
                [proxyAddress, requester.address, scheduler.address],
                [
                    -taskPrice, // PoCo proxy
                    taskPrice, // requester
                    0, // scheduler
                ],
            );
            await expectFrozen(
                requester.address,
                initialRequesterFrozen - taskPrice, // 2nd & 3rd tasks can still be claimed
            );
            await expectFrozen(scheduler.address, initialSchedulerFrozen - schedulerTaskStake);
            await expectFrozen(kittyAddress, initialKittyFrozen + schedulerTaskStake);
        });

        it('Should claim two tasks', async function () {
            const expectedVolume = 3n; // > 1 to explicit taskPrice vs dealPrice
            const tasksToClaim = 2n;
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * expectedVolume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume: expectedVolume,
            });
            await signOrders(domain, orders, ordersActors);
            const schedulerDealStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            const schedulerTaskStake = schedulerDealStake / expectedVolume;
            await iexecWrapper.depositInIexecAccount(requester, dealPrice);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerDealStake);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const initialRequesterFrozen = await frozenOf(requester.address);
            const initialSchedulerFrozen = await frozenOf(scheduler.address);
            const initialKittyFrozen = await frozenOf(kittyAddress);
            await time.setNextBlockTimestamp(startTime + 7n * categoryTime); // claim on deadline
            for (let index = 0n; index < tasksToClaim; index++) {
                const claimBoostTx = await iexecPocoBoostInstance
                    .connect(worker)
                    .claimBoost(dealId, index);
                const claimedTasks = index + 1n;
                // Verifications after claiming "claimedTasks" tasks.
                // Check balances and frozens
                await expect(claimBoostTx).to.changeTokenBalances(
                    iexecAccessor,
                    [proxyAddress, requester.address, scheduler.address],
                    [
                        -taskPrice, // PoCo proxy
                        taskPrice, // requester
                        0, // scheduler
                    ],
                );
                await expectFrozen(
                    requester.address,
                    initialRequesterFrozen - taskPrice * claimedTasks,
                );
                await expectFrozen(
                    scheduler.address,
                    initialSchedulerFrozen - schedulerTaskStake * claimedTasks,
                );
                await expectFrozen(
                    kittyAddress,
                    initialKittyFrozen + schedulerTaskStake * claimedTasks,
                );
            }
        });

        it('Should claim by anyone when match orders is sponsored', async function () {
            const expectedVolume = 3n; // > 1 to explicit taskPrice vs dealPrice
            const taskPrice = appPrice + datasetPrice + workerpoolPrice;
            const dealPrice = taskPrice * expectedVolume;
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
                prices: ordersPrices,
                volume: expectedVolume,
            });
            await signOrders(domain, orders, ordersActors);
            const schedulerDealStake = computeSchedulerDealStake(workerpoolPrice, expectedVolume);
            const schedulerTaskStake = schedulerDealStake / expectedVolume;
            await iexecWrapper.depositInIexecAccount(sponsor, dealPrice);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerDealStake);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .connect(sponsor)
                .sponsorMatchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const initialRequesterFrozen = await frozenOf(requester.address);
            const initialSponsorFrozen = await frozenOf(sponsor.address);
            const initialSchedulerFrozen = await frozenOf(scheduler.address);
            const initialKittyFrozen = await frozenOf(kittyAddress);
            await time.setNextBlockTimestamp(startTime + 7n * categoryTime); // claim on deadline

            const claimBoostTx = await iexecPocoBoostInstance
                .connect(anyone)
                .claimBoost(dealId, taskIndex);
            await expect(claimBoostTx)
                .to.emit(iexecPocoBoostInstance, 'Transfer')
                .withArgs(proxyAddress, sponsor.address, taskPrice)
                .to.emit(iexecPocoBoostInstance, 'Unlock')
                .withArgs(sponsor.address, taskPrice)
                .to.emit(iexecPocoBoostInstance, 'Seize')
                .withArgs(scheduler.address, schedulerTaskStake, taskId)
                .to.emit(iexecPocoBoostInstance, 'Reward')
                .withArgs(kittyAddress, schedulerTaskStake, taskId)
                .to.emit(iexecPocoBoostInstance, 'Lock')
                .withArgs(kittyAddress, schedulerTaskStake)
                .to.emit(iexecPocoBoostInstance, 'TaskClaimed')
                .withArgs(taskId);

            // Check task status
            expect((await iexecAccessor.viewTask(taskId)).status).to.equal(TaskStatusEnum.FAILED);
            // Check balances and frozens
            await expect(claimBoostTx).to.changeTokenBalances(
                iexecAccessor,
                [proxyAddress, requester.address, sponsor.address, scheduler.address],
                [
                    -taskPrice, // PoCo proxy
                    0, // requester
                    taskPrice, // sponsor
                    0, // scheduler
                ],
            );
            await expectFrozen(requester.address, initialRequesterFrozen);
            await expectFrozen(
                sponsor.address,
                initialSponsorFrozen - taskPrice, // 2nd & 3rd tasks can still be claimed
            );
            await expectFrozen(scheduler.address, initialSchedulerFrozen - schedulerTaskStake);
            await expectFrozen(kittyAddress, initialKittyFrozen + schedulerTaskStake);
        });

        it('Should not claim if wrong deal ID', async function () {
            await expect(
                iexecPocoBoostInstance
                    .connect(worker)
                    .claimBoost(
                        '0x00000000000000000000000000000000000000000000000000000000fac6dea1',
                        0,
                    ),
            ).to.be.revertedWith('PocoBoost: Unknown task');
        });

        it('Should not claim if out-of-range task index', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());

            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(
                    dealId, // existing deal
                    1, // only task index 0 would be authorized with this deal volume of 1
                ),
            ).to.be.revertedWith('PocoBoost: Unknown task');
        });

        // Different test than other `Should not claim if task not unset` test
        it('Should not claim twice', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            await time.setNextBlockTimestamp(startTime + 7n * categoryTime);
            // Claim
            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex),
            ).to.emit(iexecPocoBoostInstance, 'TaskClaimed');
            // Claim a second time
            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex),
            ).to.be.revertedWith('PocoBoost: Task status not unset');
        });

        it('Should not claim if task not unset', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const taskId = getTaskId(dealId, taskIndex);
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
                worker.address,
                taskId,
                constants.NULL.ADDRESS,
                scheduler,
            );
            await iexecPocoBoostInstance
                .connect(worker)
                .pushResultBoost(
                    dealId,
                    taskIndex,
                    results,
                    constants.NULL.BYTES32,
                    schedulerSignature,
                    constants.NULL.ADDRESS,
                    constants.NULL.SIGNATURE,
                );

            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex),
            ).to.be.revertedWith('PocoBoost: Task status not unset');
        });

        it('Should not claim before deadline', async function () {
            const orders = buildOrders({
                assets: ordersAssets,
                requester: requester.address,
            });
            await signOrders(domain, orders, ordersActors);
            const dealId = getDealId(domain, orders.requester, taskIndex);
            const startTime = await setNextBlockTimestamp();
            await iexecPocoBoostInstance
                .matchOrdersBoost(...orders.toArray())
                .then((tx) => tx.wait());
            await time.setNextBlockTimestamp(
                startTime +
                    7n * categoryTime - // claim
                    1n, // just before deadline
            );

            await expect(
                iexecPocoBoostInstance.connect(worker).claimBoost(dealId, taskIndex),
            ).to.be.revertedWith('PocoBoost: Deadline not reached');
        });
    });
});

/**
 * Deploy an ERC734 mock contract.
 * @returns An ERC734 mock contract instance.
 */
async function deployErc734MockContract() {
    return new ERC734Mock__factory()
        .connect(anyone)
        .deploy()
        .then((contract) => contract.waitForDeployment());
}

/**
 * If the ERC734 identity contract is asked if a given candidate is in a group, then
 * return true.
 * @param erc734IdentityContractInstance A ERC734 mock identity contract instance.
 * @param candidate The candidate that should belong to the group.
 */
async function whenIdentityContractCalledForCandidateInGroupThenReturnTrue(
    erc734IdentityContractInstance: ERC734Mock,
    candidate: string,
) {
    await erc734IdentityContractInstance
        .setKeyHasPurpose(addressToBytes32(candidate), await iexecAccessor.groupmember_purpose())
        .then((tx) => tx.wait());
}

/**
 * Deploy an ERC1271 mock contract.
 * @returns An ERC1271 mock contract instance address.
 */
async function deployErc1271MockContract() {
    return new ERC1271Mock__factory()
        .connect(anyone)
        .deploy()
        .then((contract) => contract.waitForDeployment())
        .then((deployedContract) => deployedContract.getAddress());
}

/**
 * Convert an address to a bytes32 prefixed with zeros.
 * @param address The address to convert to bytes32.
 * @returns The address in bytes32 format.
 */
function addressToBytes32(address: string): string {
    return ethers.zeroPadValue(address, 32).toLowerCase();
}

/**
 * Compute the amount of RLC to be staked by the scheduler
 * for a deal. We first compute the percentage by task
 * (See contracts/Store.sol#WORKERPOOL_STAKE_RATIO), then
 * compute the total amount according to the volume.
 * @param workerpoolPrice
 * @param volume number of tasks in the deal
 * @returns amount of total stake
 */
function computeSchedulerDealStake(workerpoolPrice: bigint, volume: bigint) {
    return ((workerpoolPrice * workerpoolStakeRatio) / 100n) * volume;
}

async function expectOrderConsumed(orderHash: string, expectedConsumedVolume: bigint) {
    expect(await iexecAccessor.viewConsumed(orderHash)).to.equal(expectedConsumedVolume);
}

async function frozenOf(account: string) {
    return await iexecAccessor.frozenOf(account);
}

async function expectFrozen(account: string, expectedFrozenValue: bigint) {
    expect(await frozenOf(account)).to.equal(expectedFrozenValue);
}

async function viewDealBoost(dealId: string) {
    return await IexecPocoBoostAccessorsDelegate__factory.connect(
        proxyAddress,
        ethers.provider,
    ).viewDealBoost(dealId);
}
