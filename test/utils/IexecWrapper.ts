// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import {
    ContractTransactionReceipt,
    EventFragment,
    EventLog,
    Interface,
    TypedDataDomain,
    ZeroAddress,
    ZeroHash,
} from 'ethers';
import hre, { ethers } from 'hardhat';
import {
    AppRegistry,
    AppRegistry__factory,
    DatasetRegistry,
    DatasetRegistry__factory,
    IexecAccessors__factory,
    IexecConfigurationFacet__factory,
    IexecInterfaceNative__factory,
    IexecLibOrders_v5,
    IexecPoco2__factory,
    IexecPocoAccessors__factory,
    IexecPocoBoostAccessors__factory,
    RLC__factory,
    Registry__factory,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
    Workerpool__factory,
} from '../../typechain';
import { TransferEvent } from '../../typechain/contracts/registries/IRegistry';
import { IexecPoco1__factory } from '../../typechain/factories/contracts/interfaces/IexecPoco1.v8.sol/IexecPoco1__factory';
import config from '../../utils/config';
import {
    IexecOrders,
    OrderOperation,
    hashOrder,
    signOrderOperation,
    signOrders,
} from '../../utils/createOrders';
import {
    IexecAccounts,
    PocoMode,
    buildAndSignContributionAuthorizationMessage,
    buildAndSignPocoClassicEnclaveMessage,
    buildResultHashAndResultSeal,
    getDealId,
    getTaskId,
    setNextBlockTimestamp,
} from '../../utils/poco-tools';

export class IexecWrapper {
    proxyAddress: string;
    accounts: IexecAccounts;
    domain: TypedDataDomain;

    constructor(proxyAddress: string, accounts: IexecAccounts) {
        this.proxyAddress = proxyAddress;
        this.accounts = accounts;
        this.domain = {
            name: 'iExecODB',
            version: '5.0.0',
            chainId: hre.network.config.chainId,
            verifyingContract: this.proxyAddress,
        };
    }

    /**
     * Get configured domain.
     * @returns domain object
     */
    getDomain() {
        return this.domain;
    }

    /**
     * Deposit value in iExec account.
     * @param value The value to deposit.
     * @param account Deposit value for an account.
     */
    async depositInIexecAccount(account: SignerWithAddress, value: bigint) {
        if (config.isNativeChain()) {
            await IexecInterfaceNative__factory.connect(this.proxyAddress, account)
                .deposit({
                    value: (value * 10n ** 9n).toString(),
                })
                .then((tx) => tx.wait());
            return;
        }
        const rlc = RLC__factory.connect(
            await IexecAccessors__factory.connect(this.proxyAddress, this.accounts.anyone).token(),
            this.accounts.iexecAdmin,
        );
        // Transfer RLC from owner to recipient
        await rlc.transfer(account.address, value).then((tx) => tx.wait());
        // Deposit
        await rlc
            .connect(account)
            .approveAndCall(this.proxyAddress, value, '0x')
            .then((tx) => tx.wait());
    }

    // TODO rename to computeSchedulerStakePerDeal
    /**
     * Compute the amount of RLCs to be staked by the scheduler
     * for a deal. We first compute the percentage by task
     * (See contracts/Store.sol#WORKERPOOL_STAKE_RATIO), then
     * compute the total amount according to the volume.
     * @param workerpoolPrice
     * @param volume number of tasks of a deal
     * @returns total amount to stake by the scheduler
     */
    async computeSchedulerDealStake(workerpoolPrice: bigint, volume: bigint): Promise<bigint> {
        const stakeRatio = await IexecAccessors__factory.connect(
            this.proxyAddress,
            this.accounts.anyone,
        ).workerpool_stake_ratio();
        return ((workerpoolPrice * stakeRatio) / 100n) * volume;
    }

    /**
     * Compute the amount of RLC tokens to be staked by the
     * worker in order to contribute to a task.
     * @param workerpoolAddress address of the workerpool
     * @param workerpoolPrice price of the workerpool
     * @returns value of worker stake
     */
    async computeWorkerTaskStake(workerpoolAddress: string, workerpoolPrice: bigint) {
        // TODO make "m_workerStakeRatioPolicy()" as view function in IWorkerpool.v8 and use it.
        const workerStakeRatio = await Workerpool__factory.connect(
            workerpoolAddress,
            this.accounts.anyone,
        ).m_workerStakeRatioPolicy();
        return (workerpoolPrice * workerStakeRatio) / 100n;
    }

    /**
     * Get the scheduler reward ratio policy.
     * @param workerpoolAddress address of the workerpool
     * @returns value of the reward
     */
    async getSchedulerRewardRatio(workerpoolAddress: string) {
        return await Workerpool__factory.connect(
            workerpoolAddress,
            this.accounts.anyone,
        ).m_schedulerRewardRatioPolicy();
    }

    /**
     * Compute the amount of RLC tokens that are rewarded to workers when
     * a task is finalized.
     * @param dealId
     * @param mode
     * @returns
     */
    async computeWorkersRewardPerTask(dealId: string, mode: PocoMode) {
        if (mode === PocoMode.BOOST) {
            return (
                await IexecPocoBoostAccessors__factory.connect(
                    this.proxyAddress,
                    ethers.provider,
                ).viewDealBoost(dealId)
            ).workerReward;
        }
        // CLASSIC mode.
        const deal = await IexecAccessors__factory.connect(
            this.proxyAddress,
            ethers.provider,
        ).viewDeal(dealId);
        // reward = (workerpoolPrice * workersRatio) / 100
        const workersRewardRatio = 100n - deal.schedulerRewardRatio;
        return (deal.workerpool.price * workersRewardRatio) / 100n;
    }

    async setTeeBroker(brokerAddress: string) {
        await IexecConfigurationFacet__factory.connect(this.proxyAddress, this.accounts.iexecAdmin)
            .setTeeBroker(brokerAddress)
            .then((tx) => tx.wait());
    }

    /**
     * Hash all orders using current domain.
     */
    hashOrders(orders: IexecOrders) {
        return {
            appOrderHash: this.hashOrder(orders.app),
            datasetOrderHash: this.hashOrder(orders.dataset),
            workerpoolOrderHash: this.hashOrder(orders.workerpool),
            requestOrderHash: this.hashOrder(orders.requester),
        };
    }

    /**
     * Hash an order using current domain.
     */
    hashOrder(order: Record<string, any>) {
        return hashOrder(this.domain, order);
    }

    /**
     * Sign an order operation using current domain.
     */
    async signOrderOperation(
        orderOperation: OrderOperation,
        signer: SignerWithAddress,
    ): Promise<void> {
        return signOrderOperation(this.domain, orderOperation, signer);
    }

    async signAndSponsorMatchOrders(
        appOrder: IexecLibOrders_v5.AppOrderStruct,
        datasetOrder: IexecLibOrders_v5.DatasetOrderStruct,
        workerpoolOrder: IexecLibOrders_v5.WorkerpoolOrderStruct,
        requestOrder: IexecLibOrders_v5.RequestOrderStruct,
    ) {
        return this._signAndMatchOrders(
            new IexecOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
            true,
        );
    }

    async signAndMatchOrders(
        appOrder: IexecLibOrders_v5.AppOrderStruct,
        datasetOrder: IexecLibOrders_v5.DatasetOrderStruct,
        workerpoolOrder: IexecLibOrders_v5.WorkerpoolOrderStruct,
        requestOrder: IexecLibOrders_v5.RequestOrderStruct,
    ) {
        return this._signAndMatchOrders(
            new IexecOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
            false,
        );
    }

    /**
     * @notice Before properly matching orders, this method takes care of
     * signing orders and depositing required stakes.
     * A sponsor will be in charge of paying for the deal if `withSponsor` is enabled.
     * Otherwise the requester will be in charge of paying for the deal.
     */
    private async _signAndMatchOrders(orders: IexecOrders, withSponsor: boolean) {
        await signOrders(this.domain, orders, {
            appOwner: this.accounts.appProvider,
            datasetOwner: this.accounts.datasetProvider,
            workerpoolOwner: this.accounts.scheduler,
            requester: this.accounts.requester,
        });
        const appOrder = orders.app;
        const datasetOrder = orders.dataset;
        const workerpoolOrder = orders.workerpool;
        const requestOrder = orders.requester;
        const taskIndex = await IexecAccessors__factory.connect(
            this.proxyAddress,
            ethers.provider,
        ).viewConsumed(this.hashOrder(requestOrder));
        const dealId = getDealId(this.domain, requestOrder, taskIndex);
        const taskId = getTaskId(dealId, taskIndex);
        const volume = await IexecPocoAccessors__factory.connect(
            this.proxyAddress,
            ethers.provider,
        ).computeDealVolume(appOrder, datasetOrder, workerpoolOrder, requestOrder);
        const taskPrice =
            BigInt(appOrder.appprice) +
            BigInt(datasetOrder.datasetprice) +
            BigInt(workerpoolOrder.workerpoolprice);
        const dealPrice = taskPrice * volume;
        const dealPayer = withSponsor ? this.accounts.sponsor : this.accounts.requester;
        await this.depositInIexecAccount(dealPayer, dealPrice);
        const schedulerStakePerDeal = await this.computeSchedulerDealStake(
            BigInt(workerpoolOrder.workerpoolprice),
            volume,
        );
        await this.depositInIexecAccount(this.accounts.scheduler, schedulerStakePerDeal);
        const startTime = await setNextBlockTimestamp();
        const iexecPocoAsDealPayer = IexecPoco1__factory.connect(this.proxyAddress, dealPayer);
        await (
            withSponsor
                ? iexecPocoAsDealPayer.sponsorMatchOrders(...orders.toArray())
                : iexecPocoAsDealPayer.matchOrders(...orders.toArray())
        ).then((tx) => tx.wait());
        return { dealId, taskId, taskIndex, dealPrice, schedulerStakePerDeal, startTime };
    }

    async createAssets() {
        return {
            appAddress: await this.createApp(),
            datasetAddress: await this.createDataset(),
            workerpoolAddress: await this.createWorkerpool(),
        };
    }

    async createApp() {
        const iexec = IexecAccessors__factory.connect(this.proxyAddress, this.accounts.anyone);
        const appRegistry: AppRegistry = AppRegistry__factory.connect(
            await iexec.appregistry(),
            this.accounts.appProvider,
        );
        const appReceipt = await appRegistry
            .createApp(
                this.accounts.appProvider.address,
                'my-app',
                'APP_TYPE_0',
                ZeroHash,
                ZeroHash,
                ZeroHash,
            )
            .then((tx) => tx.wait());
        return await extractRegistryEntryAddress(appReceipt);
    }

    async createDataset() {
        const iexec = IexecAccessors__factory.connect(this.proxyAddress, this.accounts.anyone);
        const datasetRegistry: DatasetRegistry = DatasetRegistry__factory.connect(
            await iexec.datasetregistry(),
            this.accounts.datasetProvider,
        );
        const datasetReceipt = await datasetRegistry
            .createDataset(this.accounts.datasetProvider.address, 'my-dataset', ZeroHash, ZeroHash)
            .then((tx) => tx.wait());
        return await extractRegistryEntryAddress(datasetReceipt);
    }

    /**
     * Helper function to initialize a task.
     * @param dealId id of the deal
     * @param taskIndex index of the task
     * @returns
     */
    async initializeTask(dealId: string, taskIndex: bigint) {
        await IexecPoco2__factory.connect(this.proxyAddress, this.accounts.anyone)
            .initialize(dealId, taskIndex)
            .then((tx) => tx.wait());
        return getTaskId(dealId, taskIndex);
    }

    /**
     * Helper function to contribute to a task. The contributor's stake is
     * automatically deposited before contributing.
     * Note: no enclave is used.
     * @param contributor Signer to sign the contribution
     * @param dealId id of the deal
     * @param taskIndex index of the task.
     * @param resultDigest hash of the result
     * @returns id of the task
     */
    async contributeToTask(
        dealId: string,
        taskIndex: bigint,
        resultDigest: string,
        contributor: SignerWithAddress,
    ) {
        const { taskId, workerStakePerTask } = await this._contributeToTask(
            dealId,
            taskIndex,
            resultDigest,
            contributor,
            false, // No enclave used
        );
        return { taskId, workerStakePerTask };
    }

    /**
     * Helper function to contribute to a task using a secure enclave. The contributor's stake is
     * automatically deposited before contributing.
     * This function is used for enclave-based contributions (involving a secure enclave address).
     * @param contributor Signer to sign the contribution
     * @param dealId id of the deal
     * @param taskIndex index of the task.
     * @param resultDigest hash of the result
     * @returns id of the task
     */
    async contributeToTeeTask(
        dealId: string,
        taskIndex: bigint,
        resultDigest: string,
        contributor: SignerWithAddress,
    ) {
        const { taskId, workerStakePerTask } = await this._contributeToTask(
            dealId,
            taskIndex,
            resultDigest,
            contributor,
            true,
        );
        return { taskId, workerStakePerTask };
    }

    /**
     * Internal helper function to handle task contributions with optional enclave support.
     * Automatically deposits the contributor's stake before contributing and handles
     * enclave-related signing and validation if required.
     * @param contributor Signer to sign the contribution
     * @param dealId id of the deal
     * @param taskIndex index of the task.
     * @param resultDigest hash of the result
     * @param useEnclave - Boolean flag indicating whether an enclave is used for this contribution.
     * @returns id of the task
     */
    async _contributeToTask(
        dealId: string,
        taskIndex: bigint,
        resultDigest: string,
        contributor: SignerWithAddress,
        useEnclave: Boolean,
    ) {
        const taskId = getTaskId(dealId, taskIndex);
        const workerStakePerTask = await IexecAccessors__factory.connect(
            this.proxyAddress,
            ethers.provider,
        )
            .viewDeal(dealId)
            .then((deal) => deal.workerStake);
        const { resultHash, resultSeal } = buildResultHashAndResultSeal(
            taskId,
            resultDigest,
            contributor,
        );
        const enclaveAddress = useEnclave ? this.accounts.enclave.address : ZeroAddress;
        const enclaveSignature = useEnclave
            ? await buildAndSignPocoClassicEnclaveMessage(
                  resultHash,
                  resultSeal,
                  this.accounts.enclave,
              )
            : '0x';
        const schedulerSignature = await buildAndSignContributionAuthorizationMessage(
            contributor.address,
            taskId,
            enclaveAddress,
            this.accounts.scheduler,
        );
        await this.depositInIexecAccount(contributor, workerStakePerTask);
        await IexecPoco2__factory.connect(this.proxyAddress, contributor)
            .contribute(
                taskId,
                resultHash,
                resultSeal,
                enclaveAddress,
                enclaveSignature,
                schedulerSignature,
            )
            .then((tx) => tx.wait());
        return { taskId, workerStakePerTask };
    }

    async createWorkerpool() {
        const iexec = IexecAccessors__factory.connect(this.proxyAddress, this.accounts.anyone);
        const workerpoolRegistry: WorkerpoolRegistry = WorkerpoolRegistry__factory.connect(
            await iexec.workerpoolregistry(),
            this.accounts.scheduler,
        );
        const workerpoolReceipt = await workerpoolRegistry
            .createWorkerpool(this.accounts.scheduler.address, 'my-workerpool')
            .then((tx) => tx.wait());
        return await extractRegistryEntryAddress(workerpoolReceipt);
    }

    async getInitialFrozens(accounts: SignerWithAddress[]) {
        let iexecPoco = IexecInterfaceNative__factory.connect(this.proxyAddress, ethers.provider);
        const initialFrozens = [];
        for (const account of accounts) {
            initialFrozens.push({
                address: account.address,
                frozen: await iexecPoco.frozenOf(account.address),
            });
        }
        return initialFrozens;
    }

    async checkFrozenChanges(
        accountsInitialFrozens: { address: string; frozen: bigint }[],
        expectedFrozenChanges: bigint[],
    ) {
        let iexecPoco = IexecInterfaceNative__factory.connect(this.proxyAddress, ethers.provider);
        for (let i = 0; i < accountsInitialFrozens.length; i++) {
            const actualFrozen = await iexecPoco.frozenOf(accountsInitialFrozens[i].address);
            const expectedFrozen = accountsInitialFrozens[i].frozen + expectedFrozenChanges[i];
            expect(actualFrozen).to.equal(expectedFrozen, `Mismatch at index ${i}`);
        }
    }

    async computeWorkersRewardForCurrentTask(totalPoolReward: bigint, dealId: string) {
        const deal = await IexecInterfaceNative__factory.connect(
            this.proxyAddress,
            ethers.provider,
        ).viewDeal(dealId);
        return (totalPoolReward * (100n - deal.schedulerRewardRatio)) / 100n;
    }
}

/**
 * Extract address of a newly created entry in a registry contract
 * from the tx receipt.
 * @param receipt contract receipt
 * @returns address of the entry in checksum format.
 */
async function extractRegistryEntryAddress(
    receipt: ContractTransactionReceipt | null,
): Promise<string> {
    if (!receipt) {
        throw new Error('Undefined tx receipt');
    }
    const registryInterface = Registry__factory.createInterface();
    const event = extractEventFromReceipt(
        receipt,
        registryInterface,
        registryInterface.getEvent('Transfer'),
    ) as any as TransferEvent.OutputObject;
    if (!event) {
        throw new Error('No event extracted from registry tx');
    }
    // Get registry address from event.
    const lowercaseAddress = ethers.zeroPadValue(ethers.toBeHex(BigInt(event.tokenId)), 20);
    // To checksum address.
    return ethers.getAddress(lowercaseAddress);
}

/**
 * Extract a specific event of a contract from tx receipt.
 * @param txReceipt
 * @param contractInterface
 * @param eventFragment
 * @returns event
 */
function extractEventFromReceipt(
    txReceipt: ContractTransactionReceipt,
    contractInterface: Interface,
    eventFragment: EventFragment,
) {
    return (
        txReceipt.logs.find(
            (log) => contractInterface.parseLog(log)?.topic === eventFragment.topicHash,
        ) as EventLog
    ).args;
}
