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

export function getTaskId(dealId: string, taskIndex: number): any {
    return ethers.utils.solidityKeccak256(['bytes32', 'uint'], [dealId, taskIndex]);
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

export function buildDefaultResultCallbackAndDigest(oracleCallValue: number) {
    return buildResultCallbackAndDigest(
        '0x0000000000000000000000000000000000000000000000000000000000000001', // random ID
        new Date(1672531200 * 1000), // random date (January 1, 2023 12:00:00 AM)
        oracleCallValue,
    );
}

export function buildResultCallbackAndDigest(
    oracleId: string,
    oracleCallDate: Date,
    oracleCallValue: number, // this is an oracle accepting "int" values (e.g: price oracle)
) {
    const oracleResult = ethers.utils.solidityKeccak256(['uint256'], [oracleCallValue]);
    const resultsCallback = ethers.utils.solidityKeccak256(
        ['bytes32', 'uint256', 'bytes'],
        [oracleId, oracleCallDate.getTime(), oracleResult],
    );
    const resultDigest = ethers.utils.keccak256(resultsCallback);
    return { resultsCallback, resultDigest };
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
