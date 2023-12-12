import { MockContract, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { IexecEscrowTestContract, IexecEscrowTestContract__factory } from '../../../typechain';

const BALANCES = 'm_balances';

describe('IexecEscrow.v8', async function () {
    const addressZero = '0x0000000000000000000000000000000000000000';
    const initialAdminBalance = 10;
    const initialWallet0Balance = 1;
    const amount = 3;
    let admin: SignerWithAddress;
    let wallet0: SignerWithAddress;
    let iexecEscrow: MockContract<IexecEscrowTestContract>;

    beforeEach(async function () {
        [admin, wallet0] = await ethers.getSigners();
        iexecEscrow = (await smock
            .mock<IexecEscrowTestContract__factory>('IexecEscrowTestContract')
            .then((instance) => instance.deploy())
            .then((contract) => contract.deployed())) as MockContract<IexecEscrowTestContract>;
        iexecEscrow.setVariable(BALANCES, {
            [iexecEscrow.address]: initialAdminBalance,
            [wallet0.address]: initialWallet0Balance,
        });
    });

    describe('Transfer', function () {
        it('Should transfer between balances', async function () {
            // Check balances before the transfer.
            expect(await iexecEscrow.getVariable(BALANCES, [iexecEscrow.address])).to.be.equal(
                initialAdminBalance,
            );
            expect(await iexecEscrow.getVariable(BALANCES, [wallet0.address])).to.be.equal(
                initialWallet0Balance,
            );
            // Do the transfer.
            await doTransfer(wallet0.address, amount);
            // Check balances after the transfer.
            expect(await iexecEscrow.getVariable(BALANCES, [iexecEscrow.address])).to.be.equal(
                initialAdminBalance - amount,
            );
            expect(await iexecEscrow.getVariable(BALANCES, [wallet0.address])).to.be.equal(
                initialWallet0Balance + amount,
            );
        });

        it('Should not transfer when from is address(0)', async function () {
            await expect(iexecEscrow.transfer__(addressZero, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer to empty address',
            );
        });

        it('Should not transfer when to is address(0)', async function () {
            await expect(iexecEscrow.transfer__(addressZero, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer to empty address',
            );
        });
    });

    async function doTransfer(to: string, amount: number) {
        const tx = await iexecEscrow.transfer__(to, amount);
        const txReceipt = await tx.wait();
        await expect(tx).to.emit(iexecEscrow, 'Transfer').withArgs(iexecEscrow.address, to, amount);
        return txReceipt.gasUsed.toBigInt();
    }
});
