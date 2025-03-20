// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';
import { Address, LaPoste__factory } from '../typechain';

//visit https://docs.chain.link/ccip/directory/testnet
const constructorArgs: Record<number, [Address, Address, bigint]> = {
    11155111: [
        '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59' as unknown as Address,
        '0x779877A7B0D9E8603169DdbD7836e478b4624789' as unknown as Address,
        BigInt('16015286601757825753'),
    ], //sepolia
    421614: [
        '0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165' as unknown as Address,
        '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E' as unknown as Address,
        BigInt('3478487238524512106'),
    ], //Arbitrum Sepolia
};

export default async function main() {
    console.log('Deploying LaPoste..');
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const [deployer] = await ethers.getSigners();

    const laPosteFactory = new LaPoste__factory(deployer);
    const args = constructorArgs[Number(chainId)];
    const laPoste = await laPosteFactory.deploy(...args);
    await laPoste.waitForDeployment();

    console.log(`LaPoste deployed to: ${await laPoste.getAddress()}`);
}
main();
