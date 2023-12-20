import { MockContract, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants } from 'ethers';
import { ethers, expect } from 'hardhat';
import { IexecEscrowTestContract, IexecEscrowTestContract__factory } from '../../../typechain';

const BALANCES = 'm_balances';
const FROZENS = 'm_frozens';

describe('IexecEscrow.v8', function () {
    // Using 0 causes an error when checking initial balance.
    const initialEscrowBalance = 10;
    const initialUserBalance = 20;
    const initialUserFrozen = 30;
    const amount = 3;
    const ref = constants.HashZero;

    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let iexecEscrow: MockContract<IexecEscrowTestContract>;

    beforeEach(async function () {
        // Get wallets.
        [deployer, user] = await ethers.getSigners();
        // Deploy the contract to be tested as a mock.
        iexecEscrow = (await smock
            .mock<IexecEscrowTestContract__factory>('IexecEscrowTestContract')
            .then((instance) => instance.deploy())
            .then((contract) => contract.deployed())) as MockContract<IexecEscrowTestContract>;
        // Set initial state of contract.
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
            await checkInitialBalancesAndFrozens();
            // Run operation.
            await expect(iexecEscrow.lock_(user.address, amount))
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(user.address, iexecEscrow.address, amount)
                .to.emit(iexecEscrow, 'Lock')
                .withArgs(user.address, amount);
            // Check balances after the operation.
            await checkBalancesAndFrozens(
                initialEscrowBalance + amount,
                initialUserBalance - amount,
                initialUserFrozen + amount,
            );
        });

        it('Should not lock funds for empty address', async function () {
            await expect(iexecEscrow.lock_(constants.AddressZero, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer from empty address',
            );
        });

        it('Should not lock funds when insufficient balance', async function () {
            await expect(
                iexecEscrow.lock_(user.address, initialUserBalance + 1),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });
    });

    describe('Unlock', function () {
        it('Should unlock funds', async function () {
            // Check balances before the operation.
            await checkInitialBalancesAndFrozens();
            // Run operation.
            await expect(iexecEscrow.unlock_(user.address, amount))
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(iexecEscrow.address, user.address, amount)
                .to.emit(iexecEscrow, 'Unlock')
                .withArgs(user.address, amount);
            // Check balances after the operation.
            await checkBalancesAndFrozens(
                initialEscrowBalance - amount,
                initialUserBalance + amount,
                initialUserFrozen - amount,
            );
        });

        it('Should not unlock funds for empty address', async function () {
            await expect(iexecEscrow.unlock_(constants.AddressZero, amount)).to.be.revertedWith(
                'IexecEscrow: Transfer to empty address',
            );
        });

        it('Should not unlock funds when insufficient balance', async function () {
            await expect(
                iexecEscrow.unlock_(user.address, initialUserFrozen + 1),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });
    });

    describe('Reward', function () {
        it('Should reward', async function () {
            // Check balances before the operation.
            await checkInitialBalancesAndFrozens();
            // Run operation.
            await expect(iexecEscrow.reward_(user.address, amount, ref))
                .to.emit(iexecEscrow, 'Transfer')
                .withArgs(iexecEscrow.address, user.address, amount)
                .to.emit(iexecEscrow, 'Reward')
                .withArgs(user.address, amount, ref);
            // Check balances after the operation.
            await checkBalancesAndFrozens(
                initialEscrowBalance - amount,
                initialUserBalance + amount,
                initialUserFrozen,
            );
        });

        it('Should not reward empty address', async function () {
            await expect(
                iexecEscrow.reward_(constants.AddressZero, amount, ref),
            ).to.be.revertedWith('IexecEscrow: Transfer to empty address');
        });

        it('Should not reward when insufficient balance', async function () {
            await expect(
                iexecEscrow.reward_(user.address, initialEscrowBalance + 1, ref),
            ).to.be.revertedWith('IexecEscrow: Transfer amount exceeds balance');
        });
    });

    describe('Seize', function () {
        it('Should seize funds', async function () {
            // Check balances before the operation.
            await checkInitialBalancesAndFrozens();
            // Run operation.
            await expect(iexecEscrow.seize_(user.address, amount, ref))
                .to.emit(iexecEscrow, 'Seize')
                .withArgs(user.address, amount, ref);
            // Check balances after the operation.
            await checkBalancesAndFrozens(
                initialEscrowBalance,
                initialUserBalance,
                initialUserFrozen - amount,
            );
        });

        it('Should not seize funds for empty address', async function () {
            await expect(
                iexecEscrow.seize_(constants.AddressZero, amount, ref),
            ).to.be.revertedWithPanic(0x11);
        });

        it('Should not seize funds when insufficient balance', async function () {
            await expect(
                iexecEscrow.seize_(user.address, initialUserFrozen + 1, ref),
            ).to.be.revertedWithPanic(0x11);
        });
    });

    async function checkInitialBalancesAndFrozens() {
        checkBalancesAndFrozens(initialEscrowBalance, initialUserBalance, initialUserFrozen);
    }

    async function checkBalancesAndFrozens(
        escrowBalance: number,
        userBalance: number,
        userFrozen: number,
    ) {
        expect(await iexecEscrow.getVariable(BALANCES, [iexecEscrow.address])).to.be.equal(
            escrowBalance,
        );
        expect(await iexecEscrow.getVariable(BALANCES, [user.address])).to.be.equal(userBalance);
        expect(await iexecEscrow.getVariable(FROZENS, [user.address])).to.be.equal(userFrozen);
    }
});
