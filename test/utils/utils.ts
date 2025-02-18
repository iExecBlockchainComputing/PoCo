import { ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { IexecLibOrders_v5 } from '../../typechain';

export async function hashDomain(domain: IexecLibOrders_v5.EIP712DomainStructOutput) {
    return ethers.TypedDataEncoder.hashDomain({
        name: domain.name,
        version: domain.version,
        chainId: domain.chainId,
        verifyingContract: domain.verifyingContract,
    });
}

/**
 * Send some ETH the zero address to allow sending transactions using
 * Hardhat's impersonation mechanism.
 * Fixes the error:
 * ProviderError: Sender doesn't have enough funds to send tx ...
 */
export async function setZeroAddressBalance(amount: bigint) {
    await ethers.provider.send('hardhat_setBalance', [
        ZeroAddress,
        ethers.toBeHex(ethers.parseEther(amount.toString())),
    ]);
}
