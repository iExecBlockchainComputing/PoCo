// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    IexecInterfaceToken,
    IexecInterfaceToken__factory,
    RLC,
    RLC__factory,
} from '../../../typechain';
import { TAG_TEE } from '../../../utils/constants';
import {
    IexecOrders,
    OrdersActors,
    OrdersAssets,
    OrdersPrices,
    buildOrders,
    signOrders,
} from '../../../utils/createOrders';
import { getDealId, getIexecAccounts } from '../../../utils/poco-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';

const appPrice = 1000n;
const datasetPrice = 1_000_000n;
const workerpoolPrice = 1_000_000_000n;
const volume = 1n;

describe('IexecDepositAndMatchOrdersFacet', () => {
    let proxyAddress: string;
    let iexecPoco: IexecInterfaceToken;
    let iexecPocoAsRequester: IexecInterfaceToken;
    let rlcInstance: RLC;
    let rlcInstanceAsRequester: RLC;
    let [
        iexecAdmin,
        requester,
        scheduler,
        appProvider,
        datasetProvider,
        anyone,
    ]: SignerWithAddress[] = [];
    let iexecWrapper: IexecWrapper;
    let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
    let ordersActors: OrdersActors;
    let ordersAssets: OrdersAssets;
    let ordersPrices: OrdersPrices;

    beforeEach('Deploy', async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ iexecAdmin, requester, scheduler, appProvider, datasetProvider, anyone } = accounts);

        iexecPoco = IexecInterfaceToken__factory.connect(proxyAddress, anyone);
        iexecPocoAsRequester = iexecPoco.connect(requester);

        rlcInstance = RLC__factory.connect(await iexecPoco.token(), anyone);
        rlcInstanceAsRequester = rlcInstance.connect(requester);

        iexecWrapper = new IexecWrapper(proxyAddress, accounts);
        ({ appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets());

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

        // Transfer RLC to accounts for testing
        const totalAmount = (appPrice + datasetPrice + workerpoolPrice) * volume * 100n;
        await rlcInstance
            .connect(iexecAdmin)
            .transfer(requester.address, totalAmount)
            .then((tx) => tx.wait());
        await rlcInstance
            .connect(iexecAdmin)
            .transfer(scheduler.address, totalAmount)
            .then((tx) => tx.wait());
    }

    async function signAndPrepareOrders(orders: IexecOrders): Promise<void> {
        await signOrders(iexecWrapper.getDomain(), orders, ordersActors);
    }

    it('Should deposit and match orders with all assets', async () => {
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: TAG_TEE,
            volume: volume,
        });

        await signAndPrepareOrders(orders);

        const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
        const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            volume,
        );

        await rlcInstanceAsRequester.approve(proxyAddress, dealCost).then((tx) => tx.wait());
        await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

        const initialTotalSupply = await iexecPoco.totalSupply();

        // Get order hashes for event verification
        const { appOrderHash, datasetOrderHash, workerpoolOrderHash, requestOrderHash } =
            iexecWrapper.hashOrders(orders);

        const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);
        expect(
            await iexecPocoAsRequester.depositAndMatchOrders.staticCall(
                orders.app,
                orders.dataset,
                orders.workerpool,
                orders.requester,
            ),
        ).to.equal(dealId);
        const tx = iexecPocoAsRequester.depositAndMatchOrders(
            orders.app,
            orders.dataset,
            orders.workerpool,
            orders.requester,
        );

        await expect(tx).to.changeTokenBalances(
            rlcInstance,
            [requester, iexecPoco],
            [-dealCost, dealCost],
        );
        await expect(tx).to.changeTokenBalances(iexecPoco, [requester], [0]);
        await expect(tx)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(AddressZero, requester.address, dealCost);

        // Verify matchOrders was called correctly by checking events
        await tx;
        await expect(tx)
            .to.emit(iexecPoco, 'DepositAndMatch')
            .withArgs(requester.address, dealCost, dealId)
            .to.emit(iexecPoco, 'SchedulerNotice')
            .withArgs(workerpoolAddress, dealId)
            .to.emit(iexecPoco, 'OrdersMatched')
            .withArgs(
                dealId,
                appOrderHash,
                datasetOrderHash,
                workerpoolOrderHash,
                requestOrderHash,
                volume,
            );

        expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost);
        expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply + dealCost);
    });

    it('Should deposit and match orders without dataset', async () => {
        const ordersWithoutDataset = buildOrders({
            assets: { ...ordersAssets, dataset: AddressZero },
            prices: { app: appPrice, workerpool: workerpoolPrice },
            requester: requester.address,
            tag: TAG_TEE,
            volume: volume,
        });

        await signAndPrepareOrders(ordersWithoutDataset);

        const dealCost = (appPrice + workerpoolPrice) * volume;
        const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            volume,
        );

        await rlcInstanceAsRequester.approve(proxyAddress, dealCost).then((tx) => tx.wait());
        await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

        const { appOrderHash, workerpoolOrderHash, requestOrderHash } =
            iexecWrapper.hashOrders(ordersWithoutDataset);

        const tx = iexecPocoAsRequester.depositAndMatchOrders(
            ordersWithoutDataset.app,
            ordersWithoutDataset.dataset,
            ordersWithoutDataset.workerpool,
            ordersWithoutDataset.requester,
        );

        await expect(tx).to.changeTokenBalances(
            rlcInstance,
            [requester, iexecPoco],
            [-dealCost, dealCost],
        );
        await expect(tx).to.changeTokenBalances(iexecPoco, [requester], [0]);
        await expect(tx)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(AddressZero, requester.address, dealCost);

        const dealId = getDealId(iexecWrapper.getDomain(), ordersWithoutDataset.requester);
        await expect(tx)
            .to.emit(iexecPoco, 'DepositAndMatch')
            .withArgs(requester.address, dealCost, dealId)
            .to.emit(iexecPoco, 'SchedulerNotice')
            .withArgs(workerpoolAddress, dealId)
            .to.emit(iexecPoco, 'OrdersMatched')
            .withArgs(
                dealId,
                appOrderHash,
                ethers.ZeroHash, // datasetOrderHash is zero when no dataset
                workerpoolOrderHash,
                requestOrderHash,
                volume,
            );
    });

    it('Should use existing balance when sufficient', async () => {
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: TAG_TEE,
            volume: volume,
        });

        const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
        const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            volume,
        );

        await iexecWrapper.depositInIexecAccount(requester, dealCost * 2n);
        await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

        await signAndPrepareOrders(orders);

        const tx = iexecPocoAsRequester.depositAndMatchOrders(
            orders.app,
            orders.dataset,
            orders.workerpool,
            orders.requester,
        );
        await expect(tx).to.changeTokenBalances(rlcInstance, [requester, iexecPoco], [0, 0]);
        await expect(tx).to.changeTokenBalances(iexecPoco, [requester], [-dealCost]);

        // Verify DepositAndMatch event is emitted with 0 deposited amount (using existing balance)
        const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);
        await expect(tx)
            .to.emit(iexecPoco, 'DepositAndMatch')
            .withArgs(requester.address, 0, dealId);
    });

    it('Should deposit only the difference when partial balance exists', async () => {
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: TAG_TEE,
            volume: volume,
        });

        const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
        const partialBalance = dealCost / 2n;
        const requiredDeposit = dealCost - partialBalance;
        const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            volume,
        );

        await iexecWrapper.depositInIexecAccount(requester, partialBalance);
        await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

        await signAndPrepareOrders(orders);

        await rlcInstanceAsRequester.approve(proxyAddress, requiredDeposit).then((tx) => tx.wait());

        const initialTotalSupply = await iexecPoco.totalSupply();

        const tx = iexecPocoAsRequester.depositAndMatchOrders(
            orders.app,
            orders.dataset,
            orders.workerpool,
            orders.requester,
        );
        await expect(tx).to.changeTokenBalances(
            rlcInstance,
            [requester, iexecPoco],
            [-requiredDeposit, requiredDeposit],
        );
        await expect(tx).to.changeTokenBalances(iexecPoco, [requester], [-partialBalance]);
        await expect(tx)
            .to.emit(iexecPoco, 'Transfer')
            .withArgs(AddressZero, requester.address, requiredDeposit);

        // Verify DepositAndMatch event with partial deposit amount
        const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);
        await expect(tx)
            .to.emit(iexecPoco, 'DepositAndMatch')
            .withArgs(requester.address, requiredDeposit, dealId);

        expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply + requiredDeposit);
    });

    it('Should create the same deal structure as traditional flow', async () => {
        const orders1 = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: TAG_TEE,
            volume: volume,
            salt: ethers.hexlify(ethers.randomBytes(32)),
        });

        const orders2 = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: TAG_TEE,
            volume: volume,
            salt: ethers.hexlify(ethers.randomBytes(32)),
        });

        const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
        const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            volume,
        );

        await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake * 2n);

        await signAndPrepareOrders(orders1);
        await signAndPrepareOrders(orders2);

        const orderHashes1 = iexecWrapper.hashOrders(orders1);
        const orderHashes2 = iexecWrapper.hashOrders(orders2);

        await rlcInstanceAsRequester.approve(proxyAddress, dealCost).then((tx) => tx.wait());
        const tx1 = iexecPocoAsRequester.depositAndMatchOrders(
            orders1.app,
            orders1.dataset,
            orders1.workerpool,
            orders1.requester,
        );

        await iexecWrapper.depositInIexecAccount(requester, dealCost);
        const tx2 = iexecPocoAsRequester.matchOrders(
            orders2.app,
            orders2.dataset,
            orders2.workerpool,
            orders2.requester,
        );
        const dealId1 = getDealId(iexecWrapper.getDomain(), orders1.requester);
        const dealId2 = getDealId(iexecWrapper.getDomain(), orders2.requester);

        // Verify both transactions emit the same events
        await expect(tx1)
            .to.emit(iexecPoco, 'OrdersMatched')
            .withArgs(
                dealId1,
                orderHashes1.appOrderHash,
                orderHashes1.datasetOrderHash,
                orderHashes1.workerpoolOrderHash,
                orderHashes1.requestOrderHash,
                volume,
            );

        await expect(tx2)
            .to.emit(iexecPoco, 'OrdersMatched')
            .withArgs(
                dealId2,
                orderHashes2.appOrderHash,
                orderHashes2.datasetOrderHash,
                orderHashes2.workerpoolOrderHash,
                orderHashes2.requestOrderHash,
                volume,
            );

        const deal1 = await iexecPoco.viewDeal(dealId1);
        const deal2 = await iexecPoco.viewDeal(dealId2);

        expect(deal1.app.pointer).to.equal(deal2.app.pointer);
        expect(deal1.dataset.pointer).to.equal(deal2.dataset.pointer);
        expect(deal1.workerpool.pointer).to.equal(deal2.workerpool.pointer);
        expect(deal1.requester).to.equal(deal2.requester);
    });

    it('Should fail when caller is not the requester', async () => {
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: TAG_TEE,
            volume: volume,
        });

        const iexecPocoAsAnyone = iexecPoco.connect(anyone);

        await expect(
            (iexecPocoAsAnyone as any).depositAndMatchOrders(
                orders.app,
                orders.dataset,
                orders.workerpool,
                orders.requester,
            ),
        ).to.be.revertedWithCustomError(iexecPoco, 'DepositAndMatch_CallerMustBeRequester');
    });

    it('Should fail when RLC approval is insufficient', async () => {
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: TAG_TEE,
            volume: volume,
        });

        const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
        const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            volume,
        );

        await signAndPrepareOrders(orders);
        await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

        await rlcInstanceAsRequester.approve(proxyAddress, dealCost - 1n).then((tx) => tx.wait());

        // RLC token will revert without a specific reason string
        await expect(
            iexecPocoAsRequester.depositAndMatchOrders(
                orders.app,
                orders.dataset,
                orders.workerpool,
                orders.requester,
            ),
        ).to.be.reverted;
    });

    it('Should fail when no RLC approval is given', async () => {
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: TAG_TEE,
            volume: volume,
        });

        const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
            workerpoolPrice,
            volume,
        );

        await signAndPrepareOrders(orders);
        await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

        // No approval given - RLC token will revert without a specific reason string
        await expect(
            iexecPocoAsRequester.depositAndMatchOrders(
                orders.app,
                orders.dataset,
                orders.workerpool,
                orders.requester,
            ),
        ).to.be.reverted;
    });

    it('Should fail when scheduler has insufficient stake', async () => {
        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: TAG_TEE,
            volume: volume,
        });

        const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;

        await signAndPrepareOrders(orders);
        await rlcInstanceAsRequester.approve(proxyAddress, dealCost).then((tx) => tx.wait());

        // The function will deposit and lock the requester's funds first,
        // then matchOrders will fail due to insufficient scheduler stake
        // This results in "Transfer amount exceeds balance" when trying to unlock
        await expect(
            iexecPocoAsRequester.depositAndMatchOrders(
                orders.app,
                orders.dataset,
                orders.workerpool,
                orders.requester,
            ),
        ).to.be.reverted;
    });
});
