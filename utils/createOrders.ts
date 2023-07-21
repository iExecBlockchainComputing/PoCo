import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TypedDataDomain } from '@ethersproject/abstract-signer';
import { IexecLibOrders_v5 } from '../typechain';
import constants from './constants';
import { utils } from './odb-tools';

export function createEmptyAppOrder(): IexecLibOrders_v5.AppOrderStruct {
    return {
        app: constants.NULL.ADDRESS,
        appprice: 0,
        volume: 0,
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
        volume: 0,
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
        volume: 0,
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
        volume: 0,
        tag: constants.NULL.BYTES32,
        apprestrict: constants.NULL.ADDRESS,
        workerpoolrestrict: constants.NULL.ADDRESS,
        requesterrestrict: constants.NULL.ADDRESS,
        salt: constants.NULL.BYTES32,
        sign: constants.NULL.SIGNATURE,
    };
}

export function buildCompatibleOrders(
    app: string,
    workerpool: string,
    dataset: string,
    tag: string,
) {
    let requestOrder = createEmptyRequestOrder();
    let appOrder = createEmptyAppOrder();
    let workerpoolOrder = createEmptyWorkerpoolOrder();
    let datasetOrder = createEmptyDatasetOrder();
    // Set app
    appOrder.app = app;
    requestOrder.app = app;
    // Set workerpool
    workerpoolOrder.workerpool = workerpool;
    requestOrder.workerpool = workerpool;
    // Set dataset
    datasetOrder.dataset = dataset;
    requestOrder.dataset = dataset;
    // Set tag
    appOrder.tag = tag;
    requestOrder.tag = tag;
    return { appOrder, datasetOrder, workerpoolOrder, requestOrder };
}

/**
 * Build a domain separator from a given domain of create them for testing purposes
 * @returns a domain and a domain separator
 */
export function buildDomain(domain?: TypedDataDomain | undefined) {
    if (!domain) {
        domain = { name: 'domain-name' }; // testing purposes
    }
    const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain(domain);
    return { domain, domainSeparator };
}

/**
 * Sign an iExec EIP712 order: app, dataset, workerpool or request
 * @returns signature of order
 */
export async function signOrder(
    domain: TypedDataDomain,
    order: Record<string, any>,
    signer: SignerWithAddress,
): Promise<string> {
    let types: Record<string, any> = {};
    if ('requester' in order) {
        types = utils.buildTypes('RequestOrder');
    } else if ('app' in order) {
        types = utils.buildTypes('AppOrder');
    } else if ('dataset' in order) {
        types = utils.buildTypes('DatasetOrder');
    } else if ('workerpool' in order) {
        types = utils.buildTypes('WorkerpoolOrder');
    }
    return await signer._signTypedData(domain, types, order);
}
