// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import {
    ContractTransactionReceipt,
    Log,
    LogDescription,
    TypedDataDomain,
    ZeroAddress,
} from 'ethers';
import hre, { ethers } from 'hardhat';
import config from '../../config/config.json';
import {
    AppRegistry,
    AppRegistry__factory,
    DatasetRegistry,
    DatasetRegistry__factory,
    IexecAccessors__factory,
    IexecInterfaceNative__factory,
    IexecLibOrders_v5,
    IexecMaintenanceDelegate__factory,
    IexecPoco2__factory,
    IexecPocoAccessors__factory,
    IexecPocoBoostAccessors__factory,
    RLC__factory,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
    Workerpool__factory,
} from '../../typechain';
import { IexecPoco1__factory } from '../../typechain/factories/contracts/modules/interfaces/IexecPoco1.v8.sol/IexecPoco1__factory';
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
const DEPLOYMENT_CONFIG = config.chains.default;

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
    async depositInIexecAccount(account: SignerWithAddress, value: number) {
        switch (DEPLOYMENT_CONFIG.asset) {
            case 'Native':
                await IexecInterfaceNative__factory.connect(this.proxyAddress, account)
                    .deposit({
                        value: (value * 10 ** 9).toString(),
                    })
                    .then((tx) => tx.wait());
                break;
            case 'Token':
                const rlc = RLC__factory.connect(
                    await IexecAccessors__factory.connect(
                        this.proxyAddress,
                        this.accounts.anyone,
                    ).token(),
                    this.accounts.iexecAdmin,
                );
                // Transfer RLC from owner to recipient
                await rlc.transfer(account.address, value);
                // Deposit
                await rlc.connect(account).approveAndCall(this.proxyAddress, value, '0x');
                break;
            default:
                break;
        }
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
    async computeSchedulerDealStake(workerpoolPrice: number, volume: number): Promise<number> {
        const stakeRatio = Number(
            await IexecAccessors__factory.connect(
                this.proxyAddress,
                this.accounts.anyone,
            ).workerpool_stake_ratio(),
        );
        return Math.floor((workerpoolPrice * stakeRatio) / 100) * volume;
    }

    /**
     * Compute the amount of RLC tokens to be staked by the
     * worker in order to contribute to a task.
     * @param workerpoolAddress address of the workerpool
     * @param workerpoolPrice price of the workerpool
     * @returns value of worker stake
     */
    async computeWorkerTaskStake(workerpoolAddress: string, workerpoolPrice: number) {
        // TODO make "m_workerStakeRatioPolicy()" as view function in IWorkerpool.v8 and use it.
        const workerStakeRatio = Number(
            await Workerpool__factory.connect(
                workerpoolAddress,
                this.accounts.anyone,
            ).m_workerStakeRatioPolicy(),
        );
        return Math.floor((workerpoolPrice * workerStakeRatio) / 100);
    }

    /**
     * Get the scheduler reward ratio policy.
     * @param workerpoolAddress address of the workerpool
     * @returns value of the reward
     */
    async getSchedulerRewardRatio(workerpoolAddress: string) {
        return Number(
            await Workerpool__factory.connect(
                workerpoolAddress,
                this.accounts.anyone,
            ).m_schedulerRewardRatioPolicy(),
        );
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
            return Number(
                (
                    await IexecPocoBoostAccessors__factory.connect(
                        this.proxyAddress,
                        ethers.provider,
                    ).viewDealBoost(dealId)
                ).workerReward,
            );
        }
        // CLASSIC mode.
        const deal = await IexecAccessors__factory.connect(
            this.proxyAddress,
            ethers.provider,
        ).viewDeal(dealId);
        // reward = (workerpoolPrice * workersRatio) / 100
        const workersRewardRatio = 100 - Number(deal.schedulerRewardRatio);
        return Math.floor((Number(deal.workerpool.price) * workersRewardRatio) / 100);
    }

    async setTeeBroker(brokerAddress: string) {
        await IexecMaintenanceDelegate__factory.connect(this.proxyAddress, this.accounts.iexecAdmin)
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
        const dealId = getDealId(this.domain, requestOrder, Number(taskIndex));
        const taskId = getTaskId(dealId, Number(taskIndex));
        const volume = Number(
            await IexecPocoAccessors__factory.connect(
                this.proxyAddress,
                ethers.provider,
            ).computeDealVolume(appOrder, datasetOrder, workerpoolOrder, requestOrder),
        );
        const taskPrice =
            Number(appOrder.appprice) +
            Number(datasetOrder.datasetprice) +
            Number(workerpoolOrder.workerpoolprice);
        const dealPrice = taskPrice * volume;
        const dealPayer = withSponsor ? this.accounts.sponsor : this.accounts.requester;
        await this.depositInIexecAccount(dealPayer, dealPrice);
        const schedulerStakePerDeal = await this.computeSchedulerDealStake(
            Number(workerpoolOrder.workerpoolprice),
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
                ethers.ZeroHash,
                ethers.ZeroHash,
                ethers.ZeroHash,
            )
            .then((tx) => tx.wait());
        return await extractRegistryEntryAddress(appReceipt, await appRegistry.getAddress());
    }

    async createDataset() {
        const iexec = IexecAccessors__factory.connect(this.proxyAddress, this.accounts.anyone);
        const datasetRegistry: DatasetRegistry = DatasetRegistry__factory.connect(
            await iexec.datasetregistry(),
            this.accounts.datasetProvider,
        );
        const datasetReceipt = await datasetRegistry
            .createDataset(
                this.accounts.datasetProvider.address,
                'my-dataset',
                ethers.ZeroHash,
                ethers.ZeroHash,
            )
            .then((tx) => tx.wait());
        return await extractRegistryEntryAddress(
            datasetReceipt,
            await datasetRegistry.getAddress(),
        );
    }

    /**
     * Helper function to initialize a task.
     * @param dealId id of the deal
     * @param taskIndex index of the task
     * @returns
     */
    async initializeTask(dealId: string, taskIndex: number) {
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
        taskIndex: number,
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
        taskIndex: number,
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
        taskIndex: number,
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
            .then((deal) => Number(deal.workerStake));
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
        return await extractRegistryEntryAddress(
            workerpoolReceipt,
            await workerpoolRegistry.getAddress(),
        );
    }

    async getInitialFrozens(accounts: SignerWithAddress[]) {
        let iexecPoco = IexecInterfaceNative__factory.connect(this.proxyAddress, ethers.provider);
        const initialFrozens = [];
        for (const account of accounts) {
            initialFrozens.push({
                address: account.address,
                frozen: Number(await iexecPoco.frozenOf(account.address)),
            });
        }
        return initialFrozens;
    }

    async checkFrozenChanges(
        accountsInitialFrozens: { address: string; frozen: number }[],
        expectedFrozenChanges: number[],
    ) {
        let iexecPoco = IexecInterfaceNative__factory.connect(this.proxyAddress, ethers.provider);
        for (let i = 0; i < accountsInitialFrozens.length; i++) {
            const actualFrozen = Number(
                await iexecPoco.frozenOf(accountsInitialFrozens[i].address),
            );

            const expectedFrozen = accountsInitialFrozens[i].frozen + expectedFrozenChanges[i];
            expect(actualFrozen).to.equal(expectedFrozen, `Mismatch at index ${i}`);
        }
    }

    async computeWorkersRewardForCurrentTask(totalPoolReward: number, dealId: string) {
        const deal = await IexecInterfaceNative__factory.connect(
            this.proxyAddress,
            ethers.provider,
        ).viewDeal(dealId);
        return (totalPoolReward * (100 - Number(deal.schedulerRewardRatio))) / 100;
    }
}

/**
 * Extract address of a newly created entry in a registry contract
 * from the tx receipt.
 * @param receipt contract receipt
 * @param registryInstanceAddress address of the registry contract
 * @returns address of the entry in checksum format.
 */
async function extractRegistryEntryAddress(
    receipt: ContractTransactionReceipt | null,
    registryInstanceAddress: string,
): Promise<string> {
    if (!receipt) {
        throw new Error('Undefined tx receipt');
    }
    const eventName = 'Transfer';
    const eventAbi = [
        'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    ];
    const events = extractEventsFromReceipt(receipt, registryInstanceAddress, eventName, eventAbi);
    if (events.length === 0) {
        throw new Error('No event extracted from registry tx');
    }
    // Get registry address from event.
    const lowercaseAddress = ethers.zeroPadValue(
        ethers.toBeHex(BigInt(events[0].args.tokenId)),
        20,
    );
    // To checksum address.
    return ethers.getAddress(lowercaseAddress);
}

/**
 * Extract a specific event of a contract from tx receipt.
 * @param txReceipt
 * @param address
 * @param eventName
 * @param eventAbi
 * @returns array of events or empty array.
 */
function extractEventsFromReceipt(
    txReceipt: ContractTransactionReceipt,
    address: string,
    eventName: string,
    eventAbi: string[],
): LogDescription[] {
    return extractEvents(txReceipt.logs, address, eventName, eventAbi);
}

/**
 * Extract a specific event of a contract from tx logs.
 * @param logs
 * @param address
 * @param eventName
 * @param eventAbi
 * @returns array of events or empty array.
 */
function extractEvents(
    logs: Log[],
    address: string,
    eventName: string,
    eventAbi: string[],
): LogDescription[] {
    const eventInterface = new ethers.Interface(eventAbi);
    const event = eventInterface.getEvent(eventName);
    if (!event) {
        throw new Error('Event name and abi mismatch');
    }
    const eventId = event.topicHash;
    let extractedEvents = logs
        // Get logs of the target contract.
        .filter((log) => log.address === address && log.topics.includes(eventId))
        // Parse logs to events.
        .map((log) => eventInterface.parseLog(log))
        // Get events with the target name.
        .filter((event) => event && event.name === eventName);
    // Get only non null elements.
    // Note: using .filter(...) returns (LogDescription | null)[]
    // which is not desired.
    const events: LogDescription[] = [];
    extractedEvents.forEach((element) => element && events.push(element));
    return events;
}
