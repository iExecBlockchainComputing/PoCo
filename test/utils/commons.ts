import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'hardhat';
import { IexecInterfaceNative } from '../../typechain';

export async function getInitialFrozens(
    iexecPoco: IexecInterfaceNative,
    accounts: SignerWithAddress[],
) {
    const proxyAddress = iexecPoco.address;
    let initialFrozens = [
        {
            address: proxyAddress,
            frozen: (await iexecPoco.frozenOf(proxyAddress)).toNumber(),
        },
    ];
    for (const account of accounts) {
        initialFrozens.push({
            address: account.address,
            frozen: (await iexecPoco.frozenOf(account.address)).toNumber(),
        });
    }
    return initialFrozens;
}

export async function checkFrozenChanges(
    iexecPoco: IexecInterfaceNative,
    accountsInitialFrozens: { address: string; frozen: number }[],
    expectedFrozenChanges: number[],
) {
    for (let i = 0; i < accountsInitialFrozens.length; i++) {
        const message = `Failed with account at index ${i}`;
        expect(await iexecPoco.frozenOf(accountsInitialFrozens[i].address)).to.equal(
            accountsInitialFrozens[i].frozen + expectedFrozenChanges[i],
            message,
        );
    }
}

export async function computeWorkersRewardForCurrentTask(
    iexecPoco: IexecInterfaceNative,
    totalPoolReward: number,
    dealId: string,
) {
    const deal = await iexecPoco.viewDeal(dealId);
    return (totalPoolReward * (100 - deal.schedulerRewardRatio.toNumber())) / 100;
}
