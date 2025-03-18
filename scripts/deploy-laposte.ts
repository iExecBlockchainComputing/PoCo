// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';
import { LaPoste__factory } from '../typechain';
import { FactoryDeployer } from '../utils/FactoryDeployer';
import config from '../utils/config';

//visit https://docs.chain.link/ccip/directory/testnet
const constructorArgs: Record<number, Array<string>> = {
    11155111: [
        '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59',
        '0x779877A7B0D9E8603169DdbD7836e478b4624789',
        '16015286601757825753',
    ], //sepolia
    421614: [
        '0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165',
        '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E',
        '3478487238524512106',
    ], //Arbitrum Sepolia
};

export default async function main() {
    console.log('Deploying LaPoste..');
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const [owner] = await ethers.getSigners();
    const deploymentOptions = config.getChainConfigOrDefault(chainId);
    const salt = process.env.SALT || deploymentOptions.v5.salt || ethers.ZeroHash;

    const factoryDeployer = new FactoryDeployer(owner, salt);

    //factory is useless for now without Proxy (UUPS ou transparent)
    await factoryDeployer.deployWithFactory(
        new LaPoste__factory(),
        constructorArgs[Number(chainId)],
    );
}

main();
