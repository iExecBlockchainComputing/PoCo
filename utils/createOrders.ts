// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { TypedDataDomain } from '@ethersproject/abstract-signer';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { IexecLibOrders_v5 } from '../typechain';
import constants, { NULL } from './constants';
import { utils } from './odb-tools';
import { OrderOperationEnum } from './poco-tools';

// TODO use IexecOrders.toArray() for spreading and remove this
// if not needed anymore.
export type Orders = [
    IexecLibOrders_v5.AppOrderStruct,
    IexecLibOrders_v5.DatasetOrderStruct,
    IexecLibOrders_v5.WorkerpoolOrderStruct,
    IexecLibOrders_v5.RequestOrderStruct,
];

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

export interface MatchOrdersArgs {
    assets: OrdersAssets;
    requester: string;
    beneficiary?: string;
    tag?: string;
    prices?: OrdersPrices;
    volume?: number;
    callback?: string;
    trust?: number;
    category?: number;
    params?: string;
    salt?: string;
}

export interface OrdersActors {
    appOwner: SignerWithAddress;
    datasetOwner: SignerWithAddress;
    workerpoolOwner: SignerWithAddress;
    requester: SignerWithAddress;
}

export class IexecOrders {
    app: IexecLibOrders_v5.AppOrderStruct;
    dataset: IexecLibOrders_v5.DatasetOrderStruct;
    workerpool: IexecLibOrders_v5.WorkerpoolOrderStruct;
    requester: IexecLibOrders_v5.RequestOrderStruct;

    // Index signature to allow dynamic string keys
    [key: string]: any;

    constructor(
        app: IexecLibOrders_v5.AppOrderStruct,
        dataset: IexecLibOrders_v5.DatasetOrderStruct,
        workerpool: IexecLibOrders_v5.WorkerpoolOrderStruct,
        requester: IexecLibOrders_v5.RequestOrderStruct,
    ) {
        this.app = app;
        this.dataset = dataset;
        this.workerpool = workerpool;
        this.requester = requester;
    }

    /**
     * Convert this instance to an array to simplify spreading.
     * foo(...orders.toArray());
     * @returns an array with all orders
     */
    toArray() {
        return [this.app, this.dataset, this.workerpool, this.requester] as [
            IexecLibOrders_v5.AppOrderStruct,
            IexecLibOrders_v5.DatasetOrderStruct,
            IexecLibOrders_v5.WorkerpoolOrderStruct,
            IexecLibOrders_v5.RequestOrderStruct,
        ];
    }

    /**
     * Convert this instance to an object to simplify destructuring.
     * const { appOrder } = orders.toObject();
     * @returns an object with all orders
     */
    toObject() {
        return {
            appOrder: this.app,
            datasetOrder: this.dataset,
            workerpoolOrder: this.workerpool,
            requesterOrder: this.requester,
        };
    }
}

export interface OrderOperation {
    order: Record<string, any>;
    operation: BigNumber;
    sign: string;
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

/**
 * Create an order operation from an existing order.
 */
export function createOrderOperation<OrderType>(order: OrderType, operation: OrderOperationEnum) {
    return { order, operation: BigNumber.from(operation), sign: NULL.SIGNATURE };
}

export function buildOrders(matchOrdersArgs: MatchOrdersArgs) {
    let requestOrder = createEmptyRequestOrder();
    let appOrder = createEmptyAppOrder();
    let workerpoolOrder = createEmptyWorkerpoolOrder();
    let datasetOrder = createEmptyDatasetOrder();
    const assets = matchOrdersArgs.assets;
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
    requestOrder.requester = matchOrdersArgs.requester;
    // Set beneficiary
    if (matchOrdersArgs.beneficiary) {
        requestOrder.beneficiary = matchOrdersArgs.beneficiary;
    }
    // Set tag
    if (matchOrdersArgs.tag) {
        appOrder.tag = matchOrdersArgs.tag;
        requestOrder.tag = matchOrdersArgs.tag;
        datasetOrder.tag = matchOrdersArgs.tag;
        workerpoolOrder.tag = matchOrdersArgs.tag;
    }
    // Set prices
    const prices = matchOrdersArgs.prices;
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
    if (matchOrdersArgs.volume) {
        appOrder.volume = matchOrdersArgs.volume;
        datasetOrder.volume = matchOrdersArgs.volume;
        workerpoolOrder.volume = matchOrdersArgs.volume;
        requestOrder.volume = matchOrdersArgs.volume;
    }
    // Set callback
    if (matchOrdersArgs.callback) {
        requestOrder.callback = matchOrdersArgs.callback;
    }
    // Set trust
    if (matchOrdersArgs.trust) {
        requestOrder.trust = matchOrdersArgs.trust;
        workerpoolOrder.trust = matchOrdersArgs.trust;
    }
    // Set category
    if (matchOrdersArgs.category) {
        requestOrder.category = matchOrdersArgs.category;
        workerpoolOrder.category = matchOrdersArgs.category;
    }
    // Set params
    if (matchOrdersArgs.params) {
        requestOrder.params = matchOrdersArgs.params;
    }
    // Set salt
    if (matchOrdersArgs.salt) {
        appOrder.salt = matchOrdersArgs.salt;
        datasetOrder.salt = matchOrdersArgs.salt;
        workerpoolOrder.salt = matchOrdersArgs.salt;
        requestOrder.salt = matchOrdersArgs.salt;
    }
    return {
        orders: new IexecOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
        // TODO remove these additional return values and use function toObject() for
        // deserialization:
        // const {appOrder, ...} = orders.toObject();
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
    signers: OrdersActors,
): Promise<void> {
    await signOrder(domain, orders.app, signers.appOwner);
    if (orders.dataset) {
        await signOrder(domain, orders.dataset, signers.datasetOwner);
    }
    await signOrder(domain, orders.workerpool, signers.workerpoolOwner);
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
 * Sign an iExec EIP712 order operation for app, dataset, workerpool or request
 * order operations.
 */
export async function signOrderOperation(
    domain: TypedDataDomain,
    orderOperation: OrderOperation,
    signer: SignerWithAddress,
): Promise<void> {
    return utils.signStruct(
        getTypeOf(orderOperation.order) + 'Operation',
        orderOperation,
        domain,
        signer,
    );
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
