// SPDX-FileCopyrightText: 2023-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { TypedDataDomain } from '@ethersproject/abstract-signer';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { IexecLibOrders_v5 } from '../typechain';
import { hashOrder } from './createOrders';

export interface Category {
    name: string;
    description: string;
    workClockTimeRef: number;
}

export enum TaskStatusEnum {
    UNSET,
    ACTIVE,
    REVEALING,
    COMPLETED,
    FAILED,
}

export enum ContributionStatusEnum {
    UNSET,
    CONTRIBUTED,
    PROVED,
    REJECTED,
}

export enum OrderOperationEnum {
    SIGN,
    CLOSE,
}

export interface IexecAccounts {
    iexecAdmin: SignerWithAddress;
    requester: SignerWithAddress;
    sponsor: SignerWithAddress;
    beneficiary: SignerWithAddress;
    appProvider: SignerWithAddress;
    datasetProvider: SignerWithAddress;
    scheduler: SignerWithAddress;
    worker: SignerWithAddress;
    worker1: SignerWithAddress;
    worker2: SignerWithAddress;
    worker3: SignerWithAddress;
    worker4: SignerWithAddress;
    enclave: SignerWithAddress;
    sms: SignerWithAddress;
    anyone: SignerWithAddress;
}

export async function getIexecAccounts(): Promise<IexecAccounts> {
    const signers = await ethers.getSigners();
    return {
        iexecAdmin: signers[0],
        requester: signers[1],
        sponsor: signers[2],
        beneficiary: signers[3],
        appProvider: signers[4],
        datasetProvider: signers[5],
        scheduler: signers[6],
        worker: signers[7], // same as worker1
        worker1: signers[7],
        worker2: signers[8],
        worker3: signers[9],
        worker4: signers[10],
        enclave: signers[11],
        sms: signers[12],
        anyone: signers[13],
    };
}

export function getDealId(
    domain: TypedDataDomain,
    requestOrder: IexecLibOrders_v5.RequestOrderStruct,
    taskIndex: number = 0,
): string {
    return ethers.utils.solidityKeccak256(
        ['bytes32', 'uint256'],
        [hashOrder(domain, requestOrder), taskIndex],
    );
}

export function getTaskId(dealId: string, taskIndex: number): string {
    return ethers.utils.solidityKeccak256(['bytes32', 'uint256'], [dealId, taskIndex]);
}

export async function buildAndSignContributionAuthorizationMessage(
    worker: string,
    taskId: string,
    enclave: string,
    authorizer: SignerWithAddress,
) {
    const schedulerMessage = buildContributionAuthorizationMessage(worker, taskId, enclave);
    return await signMessage(authorizer, schedulerMessage);
}

function buildContributionAuthorizationMessage(
    workerAddress: string,
    taskId: string,
    enclaveAddress: string,
) {
    return ethers.utils.solidityKeccak256(
        ['address', 'bytes32', 'address'],
        [workerAddress, taskId, enclaveAddress],
    );
}

export function buildUtf8ResultAndDigest(resultPayload: string) {
    const results = ethers.utils.toUtf8Bytes(resultPayload);
    const resultDigest = ethers.utils.keccak256(results);
    return { results, resultDigest };
}

/**
 * See `buildResultCallbackAndDigestForIntegerOracle` method.
 * Build a default date internally for a lighter usage from caller.
 */
export function buildResultCallbackAndDigest(oracleCallValue: number) {
    return buildResultCallbackAndDigestForIntegerOracle(
        new Date(1672531200 * 1000), // random date (January 1, 2023 12:00:00 AM)
        oracleCallValue,
    );
}

/**
 * Build callback and digest for an oracle accepting integer values
 * (e.g: price oracle).
 *
 * @param oracleCallDate date when the value was obtained
 * @param oracleCallValue oracle call value to report
 * @returns result callback to forward and result digest required for later
 *  signature
 */
export function buildResultCallbackAndDigestForIntegerOracle(
    oracleCallDate: Date,
    oracleCallValue: number,
) {
    const resultsCallback = ethers.utils.solidityPack(
        ['uint256', 'uint256'],
        [oracleCallDate.getTime(), oracleCallValue],
    );
    const callbackResultDigest = ethers.utils.keccak256(resultsCallback);
    return { resultsCallback, callbackResultDigest };
}

export function buildResultHash(taskId: string, resultDigest: string) {
    return ethers.utils.solidityKeccak256(['bytes32', 'bytes'], [taskId, resultDigest]);
}

export function buildResultHashAndResultSeal(
    taskId: string,
    resultDigest: string,
    worker: SignerWithAddress,
) {
    const resultHash = buildResultHash(taskId, resultDigest);
    const resultSeal = ethers.utils.solidityKeccak256(
        ['address', 'bytes32', 'bytes'],
        [worker.address, taskId, resultDigest],
    );
    return { resultHash, resultSeal };
}

/**
 * Build & sign enclave message in Poco Classic mode.
 */
export async function buildAndSignPocoClassicEnclaveMessage(
    resultHash: string,
    resultSeal: string,
    enclave: SignerWithAddress,
) {
    return await signMessage(
        enclave,
        ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [resultHash, resultSeal]),
    );
}

/**
 * Build & sign enclave message in Poco Boost mode.
 */
//TODO: Harmonize naming of buildAndSignEnclaveMessage in Classic & Boost modes
export async function buildAndSignEnclaveMessage(
    workerAddress: string,
    taskId: string,
    resultDigest: string,
    enclave: SignerWithAddress,
) {
    const enclaveMessage = buildEnclaveMessage(workerAddress, taskId, resultDigest);
    return await signMessage(enclave, enclaveMessage);
}

function buildEnclaveMessage(workerAddress: string, taskId: string, resultDigest: string) {
    return ethers.utils.solidityKeccak256(
        ['address', 'bytes32', 'bytes32'],
        [workerAddress, taskId, resultDigest],
    );
}

export async function signMessage(signerAccount: SignerWithAddress, message: string) {
    return signerAccount.signMessage(ethers.utils.arrayify(message));
}

/**
 * Mine the next block with a timestamp corresponding to an arbitrary but known
 * date in the future (10 seconds later).
 * It fixes the `Timestamp is lower than the previous block's timestamp` error.
 * Originally this method was a fix for UT but then it has been also used for IT.
 * e.g: This Error has been seen when running tests with `npm run coverage`.
 * @returns timestamp of the next block.
 */
export async function setNextBlockTimestamp() {
    const startTime = (await time.latest()) + 10;
    await time.setNextBlockTimestamp(startTime);
    return startTime;
}
