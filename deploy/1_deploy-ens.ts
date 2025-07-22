// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ZeroHash } from 'ethers';
import { deployments, ethers } from 'hardhat';
import {
    ENS,
    ENSIntegration__factory,
    ENSRegistry__factory,
    FIFSRegistrar,
    FIFSRegistrar__factory,
    IexecAccessors__factory,
    PublicResolver,
    PublicResolver__factory,
    ReverseRegistrar,
    ReverseRegistrar__factory,
} from '../typechain';
import { deploy } from '../utils/deploy-tools';

export default async function deployEns() {
    console.log('Deploying and configuring ENS..');
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (chainId < 1000) {
        // skip ENS setup for mainnet and testnet
        console.log('Skipping ENS for public networks');
        return;
    }
    const [owner] = await ethers.getSigners();
    const erc1538ProxyAddress = (await deployments.get('Diamond')).address;
    const iexecAccessorsInstance = IexecAccessors__factory.connect(erc1538ProxyAddress, owner);
    const appRegistryAddress = await iexecAccessorsInstance.appregistry();
    const datasetRegistryAddress = await iexecAccessorsInstance.datasetregistry();
    const workerpoolRegistryAddress = await iexecAccessorsInstance.workerpoolregistry();
    const ens = (await deploy(new ENSRegistry__factory(), owner, [])) as ENS;
    const ensAddress = await ens.getAddress();
    const resolver = (await deploy(new PublicResolver__factory(), owner, [
        ensAddress,
    ])) as PublicResolver;
    const resolverAddress = await resolver.getAddress();
    const reverseRegistrar = (await deploy(new ReverseRegistrar__factory(), owner, [
        ensAddress,
        resolverAddress,
    ])) as ReverseRegistrar;
    const registrars: { [name: string]: FIFSRegistrar } = {};
    // root registrar
    await registerDomain('');
    await registrars[''].register(labelhash('reverse'), owner.address).then((tx) => tx.wait());
    await ens
        .setSubnodeOwner(
            ethers.namehash('reverse'),
            labelhash('addr'),
            await reverseRegistrar.getAddress(),
        )
        .then((tx) => tx.wait());
    await registerDomain('eth');
    await registerDomain('iexec', 'eth');
    await registerDomain('v5', 'iexec.eth');
    await registerDomain('users', 'iexec.eth');
    await registerDomain('apps', 'iexec.eth');
    await registerDomain('datasets', 'iexec.eth');
    await registerDomain('pools', 'iexec.eth');
    await registerAddress('admin', 'iexec.eth', owner.address);
    await registerAddress('rlc', 'iexec.eth', await iexecAccessorsInstance.token());
    await registerAddress('core', 'v5.iexec.eth', erc1538ProxyAddress);
    await registerAddress('apps', 'v5.iexec.eth', appRegistryAddress);
    await registerAddress('datasets', 'v5.iexec.eth', datasetRegistryAddress);
    await registerAddress('workerpools', 'v5.iexec.eth', workerpoolRegistryAddress);
    await reverseRegistrar.setName('admin.iexec.eth').then((tx) => tx.wait());
    await setReverseName(erc1538ProxyAddress, 'core.v5.iexec.eth');
    await setReverseName(appRegistryAddress, 'apps.v5.iexec.eth');
    await setReverseName(datasetRegistryAddress, 'datasets.v5.iexec.eth');
    await setReverseName(workerpoolRegistryAddress, 'workerpools.v5.iexec.eth');

    /**
     * Register domain on ENS.
     */
    async function registerDomain(label: string, domain: string = ''): Promise<FIFSRegistrar> {
        const name = domain ? `${label}.${domain}` : `${label}`;
        const labelHash = label ? labelhash(label) : ZeroHash;
        const nameHash = name ? ethers.namehash(name) : ZeroHash;
        const existingRegistrarAddress = await ens.owner(nameHash);
        let registrar;
        let registrarAddress;
        if ((await ethers.provider.getCode(existingRegistrarAddress)) == '0x') {
            registrar = (await deploy(new FIFSRegistrar__factory(), owner, [ensAddress, nameHash], {
                quiet: true,
            })) as FIFSRegistrar;
            registrarAddress = await registrar.getAddress();
            if (!!name) {
                await registrars[domain]
                    .register(labelHash, registrarAddress)
                    .then((tx) => tx.wait());
            } else {
                await ens.setOwner(nameHash, registrarAddress).then((tx) => tx.wait());
            }
        } else {
            registrar = FIFSRegistrar__factory.connect(existingRegistrarAddress, ethers.provider);
            registrarAddress = await registrar.getAddress();
        }
        registrars[name] = registrar;
        console.log(`FIFSRegistrar for domain ${name}: ${registrarAddress}`);
        return registrar;
    }

    /**
     * Register address on ENS.
     */
    async function registerAddress(label: string, domain: string, address: string) {
        const name = `${label}.${domain}`;
        const labelHash = labelhash(label);
        const nameHash = ethers.namehash(name);
        // register as subdomain
        await registrars[domain]
            .connect(owner)
            .register(labelHash, owner.address)
            .then((tx) => tx.wait());
        // link to ens (resolver & addr)
        await ens
            .connect(owner)
            .setResolver(nameHash, resolverAddress)
            .then((tx) => tx.wait());
        await resolver
            .connect(owner)
            ['setAddr(bytes32,uint256,bytes)'](nameHash, 60, address)
            .then((tx) => tx.wait());
    }

    /**
     * Set ENS reverse name of contract.
     */
    async function setReverseName(contractAddress: string, name: string) {
        await ENSIntegration__factory.connect(contractAddress, owner)
            .setName(ensAddress, name)
            .then((tx) => tx.wait());
    }

    /**
     * Hash a label for the ENS.
     * See: https://docs.ens.domains/resolution/names#labelhash
     */
    function labelhash(label: string) {
        return ethers.id(label.toLowerCase());
    }
}
