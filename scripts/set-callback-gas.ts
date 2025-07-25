// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments, ethers } from 'hardhat';
import { IexecAccessors__factory, IexecConfigurationFacet__factory } from '../typechain';

(async () => {
    const requestedCallbackGas = Number(process.env.CALLBACK_GAS);
    if (!requestedCallbackGas) {
        console.error('`CALLBACK_GAS` env variable is missing. Aborting.');
        process.exit(1);
    }
    console.log(`Setting callback-gas to ${requestedCallbackGas.toLocaleString()} ..`);
    const [owner] = await ethers.getSigners();
    const diamondProxyAddress = (await deployments.get('Diamond')).address;
    const viewCallbackGas = async () =>
        (await IexecAccessors__factory.connect(diamondProxyAddress, owner).callbackgas())
            .toNumber()
            .toLocaleString();
    const callbackGasBefore = await viewCallbackGas();
    await IexecConfigurationFacet__factory.connect(diamondProxyAddress, owner)
        .setCallbackGas(requestedCallbackGas)
        .then((tx) => tx.wait());
    console.log(`Changed callback-gas from ${callbackGasBefore} to ${await viewCallbackGas()}`);
})().catch((error) => console.log(error));
