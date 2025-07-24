// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { getStorageAt } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import {
    Diamond__factory,
    DiamondLoupeFacet__factory,
    IDiamond,
    LibDiamond__factory,
} from '../../typechain';
import { DiamondArgsStruct } from '../../typechain/contracts/Diamond';
import { FacetCutAction } from 'hardhat-deploy/dist/types';
import { getFunctionSelectors } from '../../utils/proxy-tools';
import { getLibDiamondConfigOrEmpty } from '../../utils/tools';

const DIAMOND_STORAGE_POSITION = ethers.id('diamond.standard.diamond.storage');

describe('Diamond', async () => {
    let deployer: SignerWithAddress;
    let owner: SignerWithAddress;

    beforeEach('Deploy', async () => {
        [deployer, owner] = await ethers.getSigners();
    });

    describe('Deployment', () => {
        it('Should set owner at deployment', async () => {
            const diamond = await _deployDiamond([]); // No facets
            const diamondAddress = await diamond.getAddress();
            // Check the owner.
            const ownerSlotPosition = ethers.toBeHex(BigInt(DIAMOND_STORAGE_POSITION) + 3n);
            const actualOwnerAddress = await getStorageAt(diamondAddress, ownerSlotPosition);
            const expectedOwnerAddress = ethers.zeroPadValue(owner.address, 32); // Padded to 32 bytes.
            expect(actualOwnerAddress).to.equal(expectedOwnerAddress);
            // Check `DiamondCut` event with empty facet cuts.
            await expect(diamond.deploymentTransaction())
                .to.emit(diamond, 'DiamondCut')
                .withArgs([], ZeroAddress, '0x');
        });

        it('Should apply diamond cuts at deployment', async () => {
            // Deploy any facet.
            const facet = await new DiamondLoupeFacet__factory()
                .connect(deployer)
                .deploy()
                .then((tx) => tx.waitForDeployment());
            const facetCuts = [
                {
                    facetAddress: await facet.getAddress(),
                    action: FacetCutAction.Add,
                    functionSelectors: getFunctionSelectors(new DiamondLoupeFacet__factory()),
                },
            ];
            const diamond = await _deployDiamond(facetCuts);
            await expect(diamond.deploymentTransaction())
                .to.emit(diamond, 'DiamondCut')
                .withArgs(
                    [Object.values(facetCuts[0])], // Convert object to array for deep comparison.
                    ZeroAddress,
                    '0x',
                );
        });

        it.skip('[TODO] Should redirect fallback', async () => {});
        it.skip('[TODO] Should redirect receive', async () => {});
    });

    async function _deployDiamond(facetCuts: IDiamond.FacetCutStruct[]) {
        const libDiamondConfig = await getLibDiamondConfigOrEmpty(deployer);
        return await new Diamond__factory(libDiamondConfig)
            .connect(deployer)
            .deploy(facetCuts, {
                owner: owner.address,
                init: ZeroAddress,
                initCalldata: '0x',
            } as DiamondArgsStruct)
            .then((tx) => tx.waitForDeployment());
    }
});
