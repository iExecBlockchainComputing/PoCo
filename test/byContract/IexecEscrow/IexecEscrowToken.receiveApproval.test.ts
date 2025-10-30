// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
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

describe.only('IexecEscrowToken-receiveApproval', () => {
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

    function encodeOrdersForCallback(orders: IexecOrders): string {
        return ethers.AbiCoder.defaultAbiCoder().encode(
            [
                'tuple(address app, uint256 appprice, uint256 volume, bytes32 tag, address datasetrestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign)',
                'tuple(address dataset, uint256 datasetprice, uint256 volume, bytes32 tag, address apprestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign)',
                'tuple(address workerpool, uint256 workerpoolprice, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address apprestrict, address datasetrestrict, address requesterrestrict, bytes32 salt, bytes sign)',
                'tuple(address app, uint256 appmaxprice, address dataset, uint256 datasetmaxprice, address workerpool, uint256 workerpoolmaxprice, address requester, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address beneficiary, address callback, string params, bytes32 salt, bytes sign)',
            ],
            [orders.app, orders.dataset, orders.workerpool, orders.requester],
        );
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

        // it('Should not deposit when wrong token calls receiveApproval', async () => {
        //     // Deploy a fake RLC token
        //     const FakeRLC = await ethers.getContractFactory('RLC');
        //     const fakeRlc = await FakeRLC.deploy();
        //     await fakeRlc.waitForDeployment();

        //     // Give requester some fake tokens
        //     const fakeRlcAsRequester = fakeRlc.connect(requester);
        //     await fakeRlc.transfer(requester.address, 1000n);

        //     // Try to call approveAndCall with fake token
        //     await expect(
        //         fakeRlcAsRequester.approveAndCall(proxyAddress, 100n, '0x'),
        //     ).to.be.revertedWith('wrong-token');
        // });
    });
    describe('Debug receiveApproval - Deep Dive', () => {
        it('Should check RLC implementation', async () => {
            const rlcAddress = await rlcInstance.getAddress();
            const code = await ethers.provider.getCode(rlcAddress);
            console.log('RLC contract has code:', code !== '0x');
            console.log('RLC code length:', code.length);
        });

        it('Should test basic RLC approve', async () => {
            const amount = 1000n;

            // Test basic approve works
            await rlcInstanceAsRequester.approve(proxyAddress, amount);
            const allowance = await rlcInstance.allowance(requester.address, proxyAddress);
            console.log('Allowance set:', allowance.toString());
            expect(allowance).to.equal(amount);
        });

        it('Should test approveAndCall with empty data to a simple contract', async () => {
            // Deploy a simple receiver contract
            const SimpleReceiver = await ethers.getContractFactory(
                'contracts/tests/TestReceiver.sol:TestReceiver',
            );
            const receiver = await SimpleReceiver.deploy();
            await receiver.waitForDeployment();
            const receiverAddress = await receiver.getAddress();

            console.log('Receiver deployed at:', receiverAddress);

            // Give requester some RLC
            const amount = 1000n;
            await rlcInstance.transfer(requester.address, amount);

            // Try approveAndCall
            try {
                const tx = await rlcInstanceAsRequester.approveAndCall(
                    receiverAddress,
                    amount,
                    '0x',
                );
                console.log('approveAndCall to simple receiver succeeded');
                await tx.wait();
            } catch (e: any) {
                console.log('approveAndCall to simple receiver failed:', e.message);
            }
        });

        it('Should test if proxy can receive approval', async () => {
            const amount = 1000n;

            // Give requester some RLC
            await rlcInstance.transfer(requester.address, amount);

            console.log('Proxy address:', proxyAddress);
            console.log(
                'RLC balance of requester:',
                await rlcInstance.balanceOf(requester.address),
            );

            // Try to call receiveApproval directly on the proxy (simulating what RLC does)
            try {
                // Impersonate the RLC token
                const rlcAddress = await rlcInstance.getAddress();
                await ethers.provider.send('hardhat_impersonateAccount', [rlcAddress]);
                const rlcSigner = await ethers.getSigner(rlcAddress);

                // Fund the RLC address with some ETH for gas
                await iexecAdmin.sendTransaction({
                    to: rlcAddress,
                    value: ethers.parseEther('1.0'),
                });

                const iexecAsRLC = iexecPoco.connect(rlcSigner);

                const tx = await iexecAsRLC.receiveApproval(
                    requester.address,
                    amount,
                    rlcAddress,
                    '0x',
                );

                console.log('Direct receiveApproval call succeeded');
                await tx.wait();

                await ethers.provider.send('hardhat_stopImpersonatingAccount', [rlcAddress]);
            } catch (e: any) {
                console.log('Direct receiveApproval call failed:', e.message);
                if (e.data) {
                    console.log('Error data:', e.data);
                }
            }
        });
    });

    describe('receiveApproval with Order Matching', () => {
        it('Should approve, deposit and match orders with all assets', async () => {
            const orders = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            // This already deposits the scheduler stake
            await signAndPrepareOrders(orders);

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const initialBalance = await iexecPoco.balanceOf(requester.address);
            const initialTotalSupply = await iexecPoco.totalSupply();

            const encodedOrders = encodeOrdersForCallback(orders);

            console.log('Requester address:', requester.address);
            console.log('Proxy address:', proxyAddress);
            console.log('RLC address:', await rlcInstance.getAddress());
            console.log('Deal cost:', dealCost.toString());
            console.log('Encoded orders length:', encodedOrders.length);

            // First, let's try without orders to see if basic deposit works
            // const tx = await rlcInstanceAsRequester.approveAndCall(
            //     proxyAddress,
            //     dealCost,
            //     '0x' // Try with empty data first
            // );

            const tx = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                encodedOrders,
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

            // Verify frozen balance
            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost);

            // Verify total supply increased
            expect(await iexecPoco.totalSupply()).to.equal(initialTotalSupply + dealCost);
        });

        it('Should approve, deposit and match orders without dataset', async () => {
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

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const { appOrderHash, workerpoolOrderHash, requestOrderHash } =
                iexecWrapper.hashOrders(ordersWithoutDataset);

            const dealId = getDealId(iexecWrapper.getDomain(), ordersWithoutDataset.requester);
            const encodedOrders = encodeOrdersForCallback(ordersWithoutDataset);

            const tx = rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, encodedOrders);

            await expect(tx)
                .to.emit(rlcInstance, 'Transfer')
                .withArgs(requester.address, proxyAddress, dealCost);

            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, dealCost);

            await expect(tx)
                .to.emit(iexecPoco, 'ApprovalReceivedAndMatched')
                .withArgs(requester.address, dealCost, dealId);

            await expect(tx).to.emit(iexecPoco, 'OrdersMatched').withArgs(
                dealId,
                appOrderHash,
                ethers.ZeroHash, // No dataset
                workerpoolOrderHash,
                requestOrderHash,
                volume,
            );

            expect(await iexecPoco.frozenOf(requester.address)).to.equal(dealCost);
        });

        it('Should work when requester has existing balance', async () => {
            // First, deposit some tokens traditionally
            const existingDeposit = 500_000n;
            await rlcInstanceAsRequester.approve(proxyAddress, existingDeposit);
            await iexecPocoAsRequester.deposit(existingDeposit);

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

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const initialBalance = await iexecPoco.balanceOf(requester.address);
            const encodedOrders = encodeOrdersForCallback(orders);
            const dealId = getDealId(iexecWrapper.getDomain(), orders.requester);

            const tx = rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, encodedOrders);

            await expect(tx)
                .to.emit(iexecPoco, 'ApprovalReceivedAndMatched')
                .withArgs(requester.address, dealCost, dealId);

            // Total balance should be existing + new deposit - frozen
            expect(await iexecPoco.balanceOf(requester.address)).to.equal(
                initialBalance + dealCost - dealCost,
            );
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
            const encodedOrders = encodeOrdersForCallback(orders);

            await expect(
                rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, encodedOrders),
            ).to.be.revertedWith('caller-must-be-requester');
        });

        it('Should not match orders with insufficient deposit', async () => {
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

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const insufficientAmount = dealCost - 1n;
            const encodedOrders = encodeOrdersForCallback(orders);

            // Should revert from matchOrders due to insufficient balance
            await expect(
                rlcInstanceAsRequester.approveAndCall(
                    proxyAddress,
                    insufficientAmount,
                    encodedOrders,
                ),
            ).to.be.revertedWithoutReason(); // Will revert in _lock due to insufficient balance
        });

        it('Should not match orders with invalid calldata', async () => {
            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const invalidData = '0x1234'; // Too short to be valid

            await expect(rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, invalidData))
                .to.be.reverted; // Will fail during abi.decode
        });

        it('Should handle multiple sequential approveAndCall operations', async () => {
            // First operation
            const orders1 = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signAndPrepareOrders(orders1);

            const dealCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
            const encodedOrders1 = encodeOrdersForCallback(orders1);

            const tx1 = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                encodedOrders1,
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
            });

            await signAndPrepareOrders(orders2);

            const encodedOrders2 = encodeOrdersForCallback(orders2);

            const tx2 = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                encodedOrders2,
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

            await signAndPrepareOrders(ordersZeroPrice);

            const schedulerStake = await iexecWrapper.computeSchedulerDealStake(0n, volume);
            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);

            const dealCost = 0n;
            const encodedOrders = encodeOrdersForCallback(ordersZeroPrice);
            const dealId = getDealId(iexecWrapper.getDomain(), ordersZeroPrice.requester);

            const tx = rlcInstanceAsRequester.approveAndCall(proxyAddress, dealCost, encodedOrders);

            await expect(tx)
                .to.emit(iexecPoco, 'Transfer')
                .withArgs(AddressZero, requester.address, dealCost);

            await expect(tx)
                .to.emit(iexecPoco, 'ApprovalReceivedAndMatched')
                .withArgs(requester.address, dealCost, dealId);

            expect(await iexecPoco.frozenOf(requester.address)).to.equal(0n);
        });
    });

    describe('Gas comparison', () => {
        it('Should use less gas than separate transactions', async () => {
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

            await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake * 2n);

            // Traditional approach: 3 transactions
            const tx1 = await rlcInstanceAsRequester.approve(proxyAddress, dealCost);
            const receipt1 = await tx1.wait();

            const tx2 = await iexecPocoAsRequester.deposit(dealCost);
            const receipt2 = await tx2.wait();

            const tx3 = await iexecPocoAsRequester.matchOrders(
                orders.app,
                orders.dataset,
                orders.workerpool,
                orders.requester,
            );
            const receipt3 = await tx3.wait();

            const traditionalGas = receipt1!.gasUsed + receipt2!.gasUsed + receipt3!.gasUsed;

            // Reset for new test
            await iexecPocoAsRequester.withdraw(await iexecPoco.balanceOf(requester.address));

            // New approach: 1 transaction
            const orders2 = buildOrders({
                assets: ordersAssets,
                prices: ordersPrices,
                requester: requester.address,
                tag: TAG_TEE,
                volume: volume,
            });

            await signAndPrepareOrders(orders2);

            const encodedOrders = encodeOrdersForCallback(orders2);
            const tx4 = await rlcInstanceAsRequester.approveAndCall(
                proxyAddress,
                dealCost,
                encodedOrders,
            );
            const receipt4 = await tx4.wait();

            const newGas = receipt4!.gasUsed;

            console.log(`Traditional (3 txs): ${traditionalGas.toString()} gas`);
            console.log(`New (1 tx): ${newGas.toString()} gas`);
            console.log(
                `Saved: ${(traditionalGas - newGas).toString()} gas (${(((traditionalGas - newGas) * 100n) / traditionalGas).toString()}%)`,
            );

            expect(newGas).to.be.lt(traditionalGas);
        });
    });
});
