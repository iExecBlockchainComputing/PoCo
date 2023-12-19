import { MockContract, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { IexecEscrowTestContract, IexecEscrowTestContract__factory } from '../../../typechain';

const BALANCES = 'm_balances';
const FROZENS = 'm_frozens';

describe('IexecEscrow.v8', function () {
    const addressZero = '0x0000000000000000000000000000000000000000';
    const initialEscrowBalance = 10; // using 0 causes an error when checking balance.
    const initialUserBalance = 20;
    const initialUserFrozen = 30;
    const amount = 3;

    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let iexecEscrow: MockContract<IexecEscrowTestContract>;

    beforeEach(async function () {
        // Create wallets.
        [deployer, user] = await ethers.getSigners();
        // Deploy the contract to be tested as a mock.
        iexecEscrow = (await smock
            .mock<IexecEscrowTestContract__factory>('IexecEscrowTestContract')
            .then((instance) => instance.deploy())
            .then((contract) => contract.deployed())) as MockContract<IexecEscrowTestContract>;
        // Set contract's initial state.
        await iexecEscrow.setVariables({
            [BALANCES]: {
                [iexecEscrow.address]: initialEscrowBalance,
                [user.address]: initialUserBalance,
            },
            [FROZENS]: {
                [user.address]: initialUserFrozen,
            },
        });
    });

    describe('Lock', function () {
        it('Should lock funds', async function () {
            // Check balances before the operation.
            expect(await iexecEscrow.getVariable(BALANCES, [iexecEscrow.address])).to.be.equal(
                initialEscrowBalance,
            );
            expect(await iexecEscrow.getVariable(BALANCES, [user.address])).to.be.equal(
                initialUserBalance,
            );
            expect(await iexecEscrow.getVariable(FROZENS, [user.address])).to.be.equal(
                initialUserFrozen,
            );
            // Run operation.
            await expect(iexecEscrow.lock_(user.address, amount))
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(user.address, iexecEscrow.address, amount)
                .to.emit(iexecEscrow, 'Lock')
                .withArgs(user.address, amount);
            // Check balances after the operation.
            expect(await iexecEscrow.getVariable(BALANCES, [iexecEscrow.address])).to.be.equal(
                initialEscrowBalance + amount,
            );
            expect(await iexecEscrow.getVariable(BALANCES, [user.address])).to.be.equal(
                initialUserBalance - amount,
            );
            expect(await iexecEscrow.getVariable(FROZENS, [user.address])).to.be.equal(
                initialUserFrozen + amount,
            );
        });

        it('Should not lock funds for address(0)', async function () {
            await expect(iexecEscrow.lock_(addressZero, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer from empty address',
            );
        });

        it('Should not lock funds when insufficient balance', async function () {
            await expect(iexecEscrow.lock_(user.address, 1000)).to.be.revertedWith(
                'IexecEscrow: Transfer amount exceeds balance',
            );
        });
    });

    describe('Unlock', function () {
        it('Should unlock funds', async function () {
            // Check balances before the operation.
            expect(await iexecEscrow.getVariable(BALANCES, [iexecEscrow.address])).to.be.equal(
                initialEscrowBalance,
            );
            expect(await iexecEscrow.getVariable(BALANCES, [user.address])).to.be.equal(
                initialUserBalance,
            );
            expect(await iexecEscrow.getVariable(FROZENS, [user.address])).to.be.equal(
                initialUserFrozen,
            );
            // Run operation.
            await expect(iexecEscrow.unlock_(user.address, amount))
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(iexecEscrow.address, user.address, amount)
                .to.emit(iexecEscrow, 'Unlock')
                .withArgs(user.address, amount);
            // Check balances after the operation.
            expect(await iexecEscrow.getVariable(BALANCES, [iexecEscrow.address])).to.be.equal(
                initialEscrowBalance - amount,
            );
            expect(await iexecEscrow.getVariable(BALANCES, [user.address])).to.be.equal(
                initialUserBalance + amount,
            );
            expect(await iexecEscrow.getVariable(FROZENS, [user.address])).to.be.equal(
                initialUserFrozen - amount,
            );
        });

        it('Should not unlock funds for address(0)', async function () {
            await expect(iexecEscrow.unlock_(addressZero, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer to empty address',
            );
        });

        it('Should not unlock funds when insufficient balance', async function () {
            await expect(iexecEscrow.unlock_(user.address, 1000)).to.be.revertedWith(
                'IexecEscrow: Transfer amount exceeds balance',
            );
        });
    });
});
