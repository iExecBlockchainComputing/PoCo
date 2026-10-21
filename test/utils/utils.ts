import { expect } from 'chai';
import { ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { IexecInterface__factory, IexecLibOrders_v5 } from '../../typechain';

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

export function randomAddress() {
    return ethers.Wallet.createRandom().address;
}

/**
 * Assert the escrow invariant: the sRLC held by the proxy is exactly the sum of
 * every account's frozen sRLC.
 *
 * `EscrowLib.seize` and `EscrowLib.rewardAndLock` are the only escrow operations
 * that write `m_frozens` without an sRLC transfer, so they preserve this
 * invariant only when they are paired on the same value. Per-account balance and
 * frozen deltas cannot detect such a mismatch: a seize without its
 * `rewardAndLock` leaves the proxy holding sRLC no account can claim, and the
 * opposite leaves frozen values that a later unlock cannot transfer.
 *
 * The invariant assumes no account sRLC-transfers to the proxy outside of the
 * escrow (`transfer(proxyAddress, ...)` or `depositFor(proxyAddress, ...)`),
 * which no production code path does.
 */
export async function expectProxyBalanceToEqualAllFrozen(proxyAddress: string) {
    const iexecPoco = IexecInterface__factory.connect(proxyAddress, ethers.provider);
    const accounts = [
        proxyAddress, // The proxy itself never freezes, but a non null value would break the sum.
        await iexecPoco.kitty_address(),
        ...(await ethers.getSigners()).map((signer) => signer.address),
    ];
    const totalFrozen = await Promise.all(
        accounts.map((account) => iexecPoco.frozenOf(account)),
    ).then((frozens) => frozens.reduce((total, frozen) => total + frozen, 0n));
    expect(await iexecPoco.balanceOf(proxyAddress)).to.equal(totalFrozen);
}
