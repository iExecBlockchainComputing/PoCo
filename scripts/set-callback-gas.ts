// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

// Usage: CALLBACK_GAS=<value> npx hardhat run scripts/set-callback-gas.ts --network <network>

import { deployments, ethers } from 'hardhat';
import { IexecInterfaceToken__factory } from '../typechain';

(async () => {
    const requestedCallbackGas = Number(process.env.CALLBACK_GAS);
    if (!requestedCallbackGas) {
        throw new Error('`CALLBACK_GAS` env variable is missing or invalid.');
    }
    const diamondProxyAddress = (await deployments.get('Diamond')).address;
    const [owner] = await ethers.getSigners();
    const iexecPoCo = IexecInterfaceToken__factory.connect(diamondProxyAddress, owner);
    if ((await iexecPoCo.owner()) !== owner.address) {
        throw new Error(`Sender account ${owner.address} is not the PoCo owner.`);
    }
    console.log(`Setting callback-gas to ${requestedCallbackGas.toLocaleString()} ..`);
    const callbackGasBefore = (await iexecPoCo.callbackgas()).toLocaleString();
    await iexecPoCo.setCallbackGas(requestedCallbackGas).then((tx) => tx.wait());
    const callbackGasAfter = (await iexecPoCo.callbackgas()).toLocaleString();
    console.log(`Changed callback-gas from ${callbackGasBefore} to ${callbackGasAfter}`);
})().catch((error) => console.log(error));
