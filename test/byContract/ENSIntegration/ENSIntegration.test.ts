// SPDX-FileCopyrightText: 2020-2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { deployments, ethers } from 'hardhat';
import {
    ENSRegistry,
    ENSRegistry__factory,
    IexecInterfaceNative,
    IexecInterfaceNative__factory,
    PublicResolver__factory,
    ReverseRegistrar__factory,
} from '../../../typechain';
import { getIexecAccounts } from '../../../utils/poco-tools';
import { loadHardhatFixtureDeployment } from '../../utils/hardhat-fixture-deployer';
const CONFIG = require('../../../config/config.json');

describe('ENSIntegration', () => {
    let proxyAddress: string;
    let [iexecPoco, iexecPocoAsAdmin]: IexecInterfaceNative[] = [];
    let [iexecAdmin, anyone]: SignerWithAddress[] = [];
    let ensRegistry: ENSRegistry;

    beforeEach('Deploy', async () => {
        // Deploy all contracts
        proxyAddress = await loadHardhatFixtureDeployment();
        // Initialize test environment
        await loadFixture(initFixture);
    });

    async function initFixture() {
        ({ iexecAdmin, anyone } = await getIexecAccounts());
        const ensRegistryAddress = (await deployments.get('ENSRegistry')).address;
        ensRegistry = ENSRegistry__factory.connect(ensRegistryAddress, anyone);
        iexecPoco = IexecInterfaceNative__factory.connect(proxyAddress, anyone);
        iexecPocoAsAdmin = iexecPoco.connect(iexecAdmin);
    }

    describe('Forward resolution', () => {
        it('Should resolve initial names', async () => {
            if (CONFIG.chains.default.asset === 'Token') {
                expect(await resolve('rlc.iexec.eth')).to.equal(await iexecPoco.token());
            }
            expect(await resolve('admin.iexec.eth')).to.equal(iexecAdmin.address);
            expect(await resolve('core.v5.iexec.eth')).to.equal(proxyAddress);
            expect(await resolve('apps.v5.iexec.eth')).to.equal(await iexecPoco.appregistry());
            expect(await resolve('datasets.v5.iexec.eth')).to.equal(
                await iexecPoco.datasetregistry(),
            );
            expect(await resolve('workerpools.v5.iexec.eth')).to.equal(
                await iexecPoco.workerpoolregistry(),
            );
        });
    });

    describe('Reverse resolution', () => {
        it('Should lookup initial addresses', async () => {
            expect(await lookup(iexecAdmin.address)).to.equal('admin.iexec.eth');
            expect(await lookup(proxyAddress)).to.equal('core.v5.iexec.eth');
            expect(await lookup(await iexecPoco.appregistry())).to.equal('apps.v5.iexec.eth');
            expect(await lookup(await iexecPoco.datasetregistry())).to.equal(
                'datasets.v5.iexec.eth',
            );
            expect(await lookup(await iexecPoco.workerpoolregistry())).to.equal(
                'workerpools.v5.iexec.eth',
            );
        });

        it('Should register reverse resolution name', async () => {
            const name = 'test.domain.eth';
            const reverseNameHash = ethers.utils.namehash(
                `${proxyAddress.substring(2)}.addr.reverse`,
            );
            const reverseRootNameHash = ethers.utils.namehash('addr.reverse');
            const reverseRegistrarAddress = await ensRegistry.owner(reverseRootNameHash);
            const reverseResolverAddress = await ReverseRegistrar__factory.connect(
                reverseRegistrarAddress,
                anyone,
            ).defaultResolver();
            const reverseResolver = PublicResolver__factory.connect(reverseResolverAddress, anyone);
            await expect(iexecPocoAsAdmin.setName(ensRegistry.address, name))
                .to.emit(reverseResolver, 'NameChanged')
                .withArgs(reverseNameHash, name);
            expect(await lookup(proxyAddress)).to.equal(name);
        });

        it('Should not register reverse resolution name when sender is not the owner', async () => {
            await expect(
                iexecPoco.setName(ensRegistry.address, 'some.name.eth'),
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
    });

    /**
     * Get the address associated to the given ENS name using forward resolution.
     * @param domain ENS domain name
     * @returns ETH address
     */
    async function resolve(domain: string) {
        const nameHash = ethers.utils.namehash(domain);
        const resolver = await getResolver(nameHash);
        return await resolver['addr(bytes32)'](nameHash);
    }

    /**
     * Get the primary ENS name associated to the given address using reverse resolution.
     * @param address
     * @returns ENS name
     */
    async function lookup(address: string) {
        const nameHash = ethers.utils.namehash(`${address.substring(2)}.addr.reverse`);
        const reverseResolver = await getResolver(nameHash);
        return await reverseResolver.name(nameHash);
    }

    /**
     * Get resolver contract of the given name hash.
     * @param nameHash namehash of the domain name
     * @returns PublicResolver instance
     */
    async function getResolver(nameHash: string) {
        const resolverAddress = await ensRegistry.resolver(nameHash);
        return PublicResolver__factory.connect(resolverAddress, anyone);
    }
});
