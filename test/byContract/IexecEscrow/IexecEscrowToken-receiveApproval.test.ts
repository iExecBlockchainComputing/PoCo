// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { AddressZero } from '@ethersproject/constants';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import {
    DiamondCutFacet__factory,
    IexecInterfaceToken,
    IexecInterfaceToken__factory,
    MatchOrdersFacetMock__factory,
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
import { getFunctionSelectors } from '../../../utils/proxy-tools';
import { IexecWrapper } from '../../utils/IexecWrapper';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';

const appPrice = 1000n;
const datasetPrice = 1_000_000n;
const workerpoolPrice = 1_000_000_000n;
const volume = 1n;

let proxyAddress: string;
let iexecPoco: IexecInterfaceToken;
let rlcInstance: RLC;
let rlcInstanceAsRequester: RLC;
let [iexecAdmin, requester, scheduler, appProvider, datasetProvider, anyone]: SignerWithAddress[] =
    [];
let iexecWrapper: IexecWrapper;
let [appAddress, datasetAddress, workerpoolAddress]: string[] = [];
let ordersActors: OrdersActors;
let ordersAssets: OrdersAssets;
let ordersPrices: OrdersPrices;

describe('IexecEscrowToken-receiveApproval', () => {
    beforeEach('Deploy', async () => {
        proxyAddress = await loadHardhatFixtureDeployment();
        await loadFixture(initFixture);
    });

    async function initFixture() {
        const accounts = await getIexecAccounts();
        ({ iexecAdmin, requester, scheduler, appProvider, datasetProvider, anyone } = accounts);

        iexecPoco = IexecInterfaceToken__factory.connect(proxyAddress, anyone);

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

    describe('Basic receiveApproval (backward compatibility)', () => {
        it('Should deposit tokens via approveAndCall with empty data', async () => {
            const depositAmount = 1000n;
            const initialTotalSupply = await iexecPoco.totalSupply();
            const initialBalance = await iexecPoco.balanceOf(requester.address);

            const tx = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                depositAmount,
                '0x',
            );

            // Verify RLC transfer
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, depositAmount);

            // Verify internal mint
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, depositAmount);

            expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply + depositAmount);
            expect(await iexecPoco.balanceOf(requester.address)).to.equal(
                initialBalance + depositAmount,
            );
        });

        it('Should deposit 0 tokens via approveAndCall', async () => {
            const depositAmount = 0n;

            const tx = rlcInstanceAsRequester.approveAndCall(proxyAddress, depositAmount, '0x');

            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, depositAmount);

            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, depositAmount);
        });
    });

    describe('receiveApproval with generalized operation execution', () => {
        it('Should approve, deposit and execute matchOrders operation with all assets', async () => {
            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const initialBalance = await iexecPoco.balanceOf(requester.address);
            const initialTotalSupply = await iexecPoco.totalSupply();

            const tx = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                await matchOrdersCalldata(orders),
            );

            // Verify RLC transfer from requester to proxy
            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, dealCost);

            // Verify internal mint (deposit)
            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, dealCost);

            // Verify deal was matched
            const { appOrderHash, datasetOrderHash, workerpoolOrderHash, requestOrderHash } =
                iexecWrapper.hashOrders(orders);

            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);

            await expect(tx)
                .to.emit(iexecPoco, 'SchedulerNotice')
                .withArgs(workerpoolAddress, dealId);

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

            // Verify total supply increased
            expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply + dealCost);
            // The available balance remains unchanged because the deposit is immediately frozen
            expect(await iexecPoco.balanceOf(requester.address)).to.equal(initialBalance);
            // Verify frozen balance
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost);
        });

        it('Should approve, deposit and match orders without dataset', async () => {
            const ordersWithoutDataset = buildOrders({
                assets: { ...ordersAssets, dataset: AddressZero },
                prices: { app: appPrice, workerpool: workerpoolPrice },
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signOrders(iexecWrapper.getDomain(), ordersWithoutDataset, ordersActors);

            const dealCost = (appPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const { appOrderHash, workerpoolOrderHash, requestOrderHash } =
                iexecWrapper.hashOrders(ordersWithoutDataset);

            const dealId = getDealId(iexecWrapper.getDomain(), ordersWithoutDataset.requester);
            const tx = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                await matchOrdersCalldata(ordersWithoutDataset),
            );

            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, dealCost);

            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, dealCost);

            await expect(tx)
                .to.emit(iexecPoco, 'OrdersMatched')
                .withArgs(
                    dealId,
                    appOrderHash,
                    ethers.ZeroHash,
                    workerpoolOrderHash,
                    requestOrderHash,
                    volume,
                );

            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost);
        });

        it('Should work when requester has existing balance', async () => {
            // First, deposit some tokens traditionally
            const existingDeposit = 500_000n;
            await rlcInstanceAsRequester.approveAndCall(proxyAddress, existingDeposit, '0x');

            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const initialBalance = await iexecPoco.balanceOf(requester.address);
            await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                await matchOrdersCalldata(orders),
            );

            // The available balance remains unchanged because the deposit is immediately frozen
            expect(await iexecPoco.balanceOf(requester.address)).to.equal(initialBalance);
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost);
        });

        it('Should not match orders when caller is not requester', async () => {
            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: anyone.address, // Different from caller
                tag: TAG_TEE,
                volume: volume,
            });

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;

            await expect(
                rlcInstanceAsRequester.approveAndCall(
                    proxyAddress,
                    dealCost,
                    await matchOrdersCalldata(orders),
                ),
            ).to.be.revertedWithCustomError(iexecPoco, 'CallerIsNotTheRequester');
        });

        it('Should bubble up error when matchOrders fails', async () => {
            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signOrders(iexecWrapper.getDomain(), orders, ordersActors);

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const insufficientAmount = dealCost - 1n;

            // Should revert from matchOrders due to insufficient balance
            await expect(
                rlcInstanceAsRequester.approveAndCall(
                    proxyAddress,
                    insufficientAmount,
                    await matchOrdersCalldata(orders),
                ),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });

        it('Should revert with unsupported operation error for unknown function selector', async () => {
            const dealCost = 1000n;
            // Create calldata with an unsupported function selector (not matchOrders)
            // Using a random selector that doesn't exist
            const unsupportedSelector = '0x12345678';
            const dummyData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [42]);
            const invalidData = unsupportedSelector + dummyData.slice(2);

            await expect(rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, invalidData))
                .to.be.revertedWithCustomError(iexecPoco, 'UnsupportedOperation')
                .withArgs(unsupportedSelector);
        });

        it('Should not match orders with invalid calldata', async () => {
            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const invalidData = '0x1234'; // Too short to be valid

            await expect(
                rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, invalidData),
            ).to.be.revertedWithoutReason(); // Will fail during abi.decode
        });

        it('Should handle multiple sequential approveAndCall operations', async () => {
            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(
                workerpoolPrice,
                volume,
            );

            // Deposit enough stake for both deals
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake * 2n);

            // First operation
            const orders1 = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
                salt: ethers.hexlify(ethers.randomBytes(32)),
            });

            await signOrders(iexecWrapper.getDomain(), orders1, ordersActors);

            const tx1 = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                await matchOrdersCalldata(orders1),
            );

            const dealId1 = getDealId(iexecWrapper.getDomain(), orders1.requester);
            await expect(tx1)
                .to.emit(iexecPoco, 'SchedulerNotice')
                .withArgs(workerpoolAddress, dealId1);

            // Second operation with different salt
            const orders2 = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
                salt: ethers.hexlify(ethers.randomBytes(32)),
            });

            await signOrders(iexecWrapper.getDomain(), orders2, ordersActors);

            const tx2 = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                await matchOrdersCalldata(orders2),
            );

            const dealId2 = getDealId(iexecWrapper.getDomain(), orders2.requester);
            await expect(tx2)
                .to.emit(iexecPoco, 'SchedulerNotice')
                .withArgs(workerpoolAddress, dealId2);

            // Both deals should be frozen
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost * 2n);
        });

        it('Should handle zero price orders', async () => {
            const ordersZeroPrice = buildOrders({
                assets: ordersAssets,
                prices: { app: 0n, dataset: 0n, workerpool: 0n },
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signOrders(iexecWrapper.getDomain(), ordersZeroPrice, ordersActors);

            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(0n, volume);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const dealCost = 0n;

            const tx = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                await matchOrdersCalldata(ordersZeroPrice),
            );

            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, dealCost);

            expect(await iexecPoco.frozenOf(requester.address)).to.equal(0n);
        });

        it('Should revert with operation failed error when delegatecall fails silently', async () => {
            // Deploy the mock helper contract that fails silently
            // This tests that the generalized _executeOperation properly handles
            // delegatecall failures and bubbles up errors
            const mockFacetAddress = await new MatchOrdersFacetMock__factory()
                .connect(iexecAdmin)
                .deploy()
                .then((tx) => tx.waitForDeployment())
                .then((contract) => contract.getAddress());
            const matchOrdersSelector = getFunctionSelectors(
                new MatchOrdersFacetMock__factory(),
            )[0]; // matchOrders is the only function

            const diamondLoupe = await ethers.getContractAt('DiamondLoupeFacet', proxyAddress);
            const originalFacetAddress = await diamondLoupe.facetAddress(matchOrdersSelector);
            const diamondCut = DiamondCutFacet__factory.connect(proxyAddress, iexecAdmin);

            await diamondCut.diamondCut(
                [
                    {
                        facetAddress: mockFacetAddress,
                        action: FacetCutAction.Replace,
                        functionSelectors: [matchOrdersSelector],
                    },
                ],
                ethers.ZeroAddress,
                '0x',
            );

            // Now test receiveApproval - it will delegatecall to our mock which fails silently
            const depositAmount = 1000n;
            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            const tx = rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                depositAmount,
                await matchOrdersCalldata(orders),
            );
            await expect(tx).to.be.revertedWithCustomError(iexecPoco, 'OperationFailed');

            // Restore original facet
            await diamondCut.diamondCut(
                [
                    {
                        facetAddress: originalFacetAddress,
                        action: FacetCutAction.Replace,
                        functionSelectors: [matchOrdersSelector],
                    },
                ],
                ethers.ZeroAddress,
                '0x',
            );
        });
    });
});

/**
 * Helper function to simplify matchOrders calldata creation.
 */
async function matchOrdersCalldata(orders: IexecOrders) {
    // Calldata can also be created using
    // IexecInterfaceToken__factory.createInterface().encodeFunctionData('matchOrders', orders);
    return await iexecPoco.matchOrders
        .populateTransaction(...orders.toArray())
        .then((tx) => tx.data);
}
