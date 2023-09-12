/******************************************************************************
 * Copyright 2023 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TypedDataDomain } from '@ethersproject/abstract-signer';
import { IexecLibOrders_v5 } from '../typechain';
import { hashOrder } from './createOrders';
import { time } from '@nomicfoundation/hardhat-network-helpers';

export function getDealId(
    domain: TypedDataDomain,
    requestOrder: IexecLibOrders_v5.RequestOrderStruct,
    taskIndex: number,
): string {
    return ethers.utils.solidityKeccak256(
        ['bytes32', 'uint256'],
        [hashOrder(domain, requestOrder), taskIndex],
    );
}

export function getTaskId(dealId: string, taskIndex: number): string {
    return ethers.utils.solidityKeccak256(['bytes32', 'uint256'], [dealId, taskIndex]);
}

export async function buildAndSignSchedulerMessage(
    worker: string,
    taskId: string,
    enclave: string,
    scheduler: SignerWithAddress,
) {
    const schedulerMessage = buildSchedulerMessage(worker, taskId, enclave);
    return await signMessage(scheduler, schedulerMessage);
}

function buildSchedulerMessage(workerAddress: string, taskId: string, enclaveAddress: string) {
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
