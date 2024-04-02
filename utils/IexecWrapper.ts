// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, ContractReceipt } from 'ethers';
import { ethers } from 'hardhat';
import config from '../config/config.json';
import {
    AppRegistry,
    AppRegistry__factory,
    DatasetRegistry,
    DatasetRegistry__factory,
    IexecAccessors__factory,
    IexecInterfaceNative__factory,
    IexecMaintenanceDelegate__factory,
    RLC__factory,
    WorkerpoolRegistry,
    WorkerpoolRegistry__factory,
} from '../typechain';
import { IexecAccounts } from './poco-tools';
import { extractEventsFromReceipt } from './tools';
const DEPLOYMENT_CONFIG = config.chains.default;

export class IexecWrapper {
    proxyAddress: string;
    accounts: IexecAccounts;

    constructor(proxyAddress: string, accounts: IexecAccounts) {
        this.proxyAddress = proxyAddress;
        this.accounts = accounts;
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
                // Token
                // Transfer RLC from owner to recipient
                await rlc.transfer(account.address, value);
                // Deposit
                await rlc.connect(account).approveAndCall(this.proxyAddress, value, '0x');
                break;
            default:
                break;
        }
    }

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
        const stakeRatio = (
            await IexecAccessors__factory.connect(
                this.proxyAddress,
                this.accounts.anyone,
            ).workerpool_stake_ratio()
        ).toNumber();
        return ((workerpoolPrice * stakeRatio) / 100) * volume;
    }

    async setTeeBroker(brokerAddress: string) {
        await IexecMaintenanceDelegate__factory.connect(this.proxyAddress, this.accounts.iexecAdmin)
            .setTeeBroker(brokerAddress)
            .then((tx) => tx.wait());
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
                ethers.constants.HashZero,
                ethers.constants.HashZero,
                ethers.constants.HashZero,
            )
            .then((tx) => tx.wait());
        return await extractRegistryEntryAddress(appReceipt, appRegistry.address);
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
                ethers.constants.HashZero,
                ethers.constants.HashZero,
            )
            .then((tx) => tx.wait());
        return await extractRegistryEntryAddress(datasetReceipt, datasetRegistry.address);
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
        return await extractRegistryEntryAddress(workerpoolReceipt, workerpoolRegistry.address);
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
    receipt: ContractReceipt,
    registryInstanceAddress: string,
): Promise<string> {
    const events = extractEventsFromReceipt(receipt, registryInstanceAddress, 'Transfer');
    if (events && events[0].args) {
        const lowercaseAddress = ethers.utils.hexZeroPad(
            BigNumber.from(events[0].args['tokenId']).toHexString(),
            20,
        );
        return ethers.utils.getAddress(lowercaseAddress);
    }
    return '';
}
