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
 * Set the zero address's balance to a non null amount to allow sending
 * transactions using Hardhat's impersonation mechanism.
 * Fixes the error:
 * ProviderError: Sender doesn't have enough funds to send tx ...
 *
 * Note: sending ETH to address(0) does not increment its balance.
 */
export async function setZeroAddressBalance() {
    const amount = 100n; // Random large enough amount.
    await ethers.provider.send('hardhat_setBalance', [
        ZeroAddress,
        ethers.toBeHex(ethers.parseEther(amount.toString())),
    ]);
}
