// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import hre, { deployments } from 'hardhat';
import { IexecAccessors__factory, IexecMaintenanceDelegate__factory } from '../typechain';

(async () => {
    const requestedCallbackGas = Number(process.env.CALLBACK_GAS);
    if (!requestedCallbackGas) {
        console.error('`CALLBACK_GAS` env variable is missing. Aborting.');
        process.exit(1);
    }
    console.log(`Setting callback-gas to ${requestedCallbackGas.toLocaleString()} ..`);
    const [owner] = await hre.ethers.getSigners();
    const erc1538ProxyAddress = (await deployments.get('ERC1538Proxy')).address;
    const viewCallbackGas = async () =>
        (await IexecAccessors__factory.connect(erc1538ProxyAddress, owner).callbackgas())
            .toNumber()
            .toLocaleString();
    const callbackGasBefore = await viewCallbackGas();
    await IexecMaintenanceDelegate__factory.connect(erc1538ProxyAddress, owner)
        .setCallbackGas(requestedCallbackGas)
        .then((tx) => tx.wait());
    console.log(`Changed callback-gas from ${callbackGasBefore} to ${await viewCallbackGas()}`);
})().catch((error) => console.log(error));
