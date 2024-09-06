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
    console.log(`Setting callbackGas to ${requestedCallbackGas} ..`);
    const [owner] = await hre.ethers.getSigners();
    const erc1538ProxyAddress = (await deployments.get('ERC1538Proxy')).address;
    const getCallbackGas = async () =>
        IexecAccessors__factory.connect(erc1538ProxyAddress, owner).callbackgas();
    const callbackGasBefore = await getCallbackGas();
    await IexecMaintenanceDelegate__factory.connect(erc1538ProxyAddress, owner)
        .setCallbackGas(requestedCallbackGas)
        .then((tx) => tx.wait());
    console.log(`Changed callbackGas from ${callbackGasBefore} to ${await getCallbackGas()}`);
})();
