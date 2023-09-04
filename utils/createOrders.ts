import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TypedDataDomain } from '@ethersproject/abstract-signer';
import { _TypedDataEncoder } from '@ethersproject/hash';
import { IexecLibOrders_v5 } from '../typechain';
import constants from './constants';
import { utils } from './odb-tools';

// TODO clean/remove this interface.
export interface Iexec<T> {
    app: T;
    dataset: T;
    workerpool: T;
    requester: T;
    beneficiary: T;
}

export interface OrdersAssets {
    app: string;
    dataset: string;
    workerpool: string;
}

export interface OrdersPrices {
    app?: number;
    dataset?: number;
    workerpool?: number;
}

export interface OrderMatchArgs {
    assets: OrdersAssets;
    requester: string;
    beneficiary: string;
    tag: string;
    prices?: OrdersPrices;
    volume?: number;
    callback?: string;
}

export interface IexecAccounts extends Iexec<SignerWithAddress> {}

export interface IexecOrders extends Iexec<Record<string, any>> {
    app: IexecLibOrders_v5.AppOrderStruct;
    dataset: IexecLibOrders_v5.DatasetOrderStruct;
    workerpool: IexecLibOrders_v5.WorkerpoolOrderStruct;
    requester: IexecLibOrders_v5.RequestOrderStruct;
}

export function createEmptyAppOrder(): IexecLibOrders_v5.AppOrderStruct {
    return {
        app: constants.NULL.ADDRESS,
        appprice: 0,
        volume: 1,
        tag: constants.NULL.BYTES32,
        datasetrestrict: constants.NULL.ADDRESS,
        workerpoolrestrict: constants.NULL.ADDRESS,
        requesterrestrict: constants.NULL.ADDRESS,
        salt: constants.NULL.BYTES32,
        sign: constants.NULL.SIGNATURE,
    };
}

export function createEmptyRequestOrder(): IexecLibOrders_v5.RequestOrderStruct {
    return {
        app: constants.NULL.ADDRESS,
        appmaxprice: 0,
        dataset: constants.NULL.ADDRESS,
        datasetmaxprice: 0,
        workerpool: constants.NULL.ADDRESS,
        workerpoolmaxprice: 0,
        volume: 1,
        tag: constants.NULL.BYTES32,
        category: 0,
        trust: 0,
        requester: constants.NULL.ADDRESS,
        beneficiary: constants.NULL.ADDRESS,
        callback: constants.NULL.ADDRESS,
        params: '',
        salt: constants.NULL.BYTES32,
        sign: constants.NULL.SIGNATURE,
    };
}

export function createEmptyWorkerpoolOrder(): IexecLibOrders_v5.WorkerpoolOrderStruct {
    return {
        workerpool: constants.NULL.ADDRESS,
        workerpoolprice: 0,
        volume: 1,
        tag: constants.NULL.BYTES32,
        category: 0,
        trust: 0,
        apprestrict: constants.NULL.ADDRESS,
        datasetrestrict: constants.NULL.ADDRESS,
        requesterrestrict: constants.NULL.ADDRESS,
        salt: constants.NULL.BYTES32,
        sign: constants.NULL.SIGNATURE,
    };
}

export function createEmptyDatasetOrder(): IexecLibOrders_v5.DatasetOrderStruct {
    return {
        dataset: constants.NULL.ADDRESS,
        datasetprice: 0,
        volume: 1,
        tag: constants.NULL.BYTES32,
        apprestrict: constants.NULL.ADDRESS,
        workerpoolrestrict: constants.NULL.ADDRESS,
        requesterrestrict: constants.NULL.ADDRESS,
        salt: constants.NULL.BYTES32,
        sign: constants.NULL.SIGNATURE,
    };
}

export function buildCompatibleOrders(orderMatchArgs: OrderMatchArgs) {
    let requestOrder = createEmptyRequestOrder();
    let appOrder = createEmptyAppOrder();
    let workerpoolOrder = createEmptyWorkerpoolOrder();
    let datasetOrder = createEmptyDatasetOrder();
    const assets = orderMatchArgs.assets;
    // Set app
    appOrder.app = assets.app;
    requestOrder.app = assets.app;
    // Set workerpool
    workerpoolOrder.workerpool = assets.workerpool;
    requestOrder.workerpool = assets.workerpool;
    // Set dataset
    datasetOrder.dataset = assets.dataset;
    requestOrder.dataset = assets.dataset;
    // Set requester
    requestOrder.requester = orderMatchArgs.requester;
    // Set beneficiary
    requestOrder.beneficiary = orderMatchArgs.beneficiary;
    // Set tag
    appOrder.tag = orderMatchArgs.tag;
    requestOrder.tag = orderMatchArgs.tag;
    datasetOrder.tag = orderMatchArgs.tag;
    workerpoolOrder.tag = orderMatchArgs.tag;
    // Set prices
    const prices = orderMatchArgs.prices;
    if (prices) {
        if (prices.app) {
            appOrder.appprice = prices.app;
            requestOrder.appmaxprice = prices.app;
        }
        if (prices.dataset && assets.dataset != constants.NULL.ADDRESS) {
            datasetOrder.datasetprice = prices.dataset;
            requestOrder.datasetmaxprice = prices.dataset;
        }
        if (prices.workerpool) {
            workerpoolOrder.workerpoolprice = prices.workerpool;
            requestOrder.workerpoolmaxprice = prices.workerpool;
        }
    }
    // Set volume
    if (orderMatchArgs.volume) {
        appOrder.volume = orderMatchArgs.volume;
        datasetOrder.volume = orderMatchArgs.volume;
        workerpoolOrder.volume = orderMatchArgs.volume;
        requestOrder.volume = orderMatchArgs.volume;
    }
    // Set callback
    if (orderMatchArgs.callback) {
        requestOrder.callback = orderMatchArgs.callback;
    }
    return {
        orders: {
            app: appOrder,
            dataset: datasetOrder,
            workerpool: workerpoolOrder,
            requester: requestOrder,
        } as IexecOrders,
        // Expose orders differently to make them easier to use in tests
        appOrder: appOrder,
        datasetOrder: datasetOrder,
        workerpoolOrder: workerpoolOrder,
        requestOrder: requestOrder,
    };
}

/**
 * Build a domain separator from a given domain of create them for testing purposes
 * @returns a domain and a domain separator
 */
export function buildDomain(domain?: TypedDataDomain | undefined) {
    if (!domain) {
        domain = {
            name: 'domain-name',
            version: 'domain-version',
            chainId: 123,
            verifyingContract: '0x0000000000000000000000000000000000000001',
        }; // testing purposes
    }
    const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain(domain);
    return { domain, domainSeparator };
}

/**
 * Sign all orders required by `matchOrder` calls.
 * @param domain typed data domain for EIP-712 signature
 * @param orders orders to sign (app, dataset, workerpool and requester orders)
 * @param signers accounts which will respectively sign orders according to their
 *  role
 */
export async function signOrders(
    domain: TypedDataDomain,
    orders: IexecOrders,
    signers: IexecAccounts,
): Promise<void> {
    await signOrder(domain, orders.app, signers.app);
    if (orders.dataset) {
        await signOrder(domain, orders.dataset, signers.dataset);
    }
    await signOrder(domain, orders.workerpool, signers.workerpool);
    await signOrder(domain, orders.requester, signers.requester);
}

/**
 * Sign an iExec EIP712 order: app, dataset, workerpool or request
 */
export async function signOrder(
    domain: TypedDataDomain,
    order: Record<string, any>,
    signer: SignerWithAddress,
): Promise<void> {
    return utils.signStruct(getTypeOf(order), order, domain, signer);
}

/**
 * Get typed data hash of order: app, dataset, workerpool or request
 * @returns order hash
 */
export function hashOrder(domain: TypedDataDomain, order: Record<string, any>): string {
    return utils.hashStruct(getTypeOf(order), order, domain);
}

/**
 * Retrieve specific order type from generic order instance
 * @param order iExec order (app, dataset, workerpool or request orders)
 * @returns class type
 */
function getTypeOf(order: Record<string, any>): string {
    if ('requester' in order) {
        return 'RequestOrder';
    } else if ('app' in order) {
        return 'AppOrder';
    } else if ('dataset' in order) {
        return 'DatasetOrder';
    } else if ('workerpool' in order) {
        return 'WorkerpoolOrder';
    }
    return '';
}
