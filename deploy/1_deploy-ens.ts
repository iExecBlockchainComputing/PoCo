// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import hre, { deployments, ethers } from 'hardhat';
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

module.exports = async function () {
    console.log('Deploying and configuring ENS..');
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (chainId < 1000) {
        // skip ENS setup for mainnet and testnet
        return;
    }
    const [owner] = await hre.ethers.getSigners();
    const erc1538ProxyAddress = (await deployments.get('ERC1538Proxy')).address;
    const iexecAccessorsInstance = IexecAccessors__factory.connect(erc1538ProxyAddress, owner);
    const appRegistryAddress = await iexecAccessorsInstance.appregistry();
    const datasetRegistryAddress = await iexecAccessorsInstance.datasetregistry();
    const workerpoolRegistryAddress = await iexecAccessorsInstance.workerpoolregistry();
    const ens = (await deploy(new ENSRegistry__factory(), owner, [])) as ENS;
    const resolver = (await deploy(new PublicResolver__factory(), owner, [
        ens.address,
    ])) as PublicResolver;
    const reverseRegistrar = (await deploy(new ReverseRegistrar__factory(), owner, [
        ens.address,
        resolver.address,
    ])) as ReverseRegistrar;
    const registrars: { [name: string]: FIFSRegistrar } = {};
    // root registrar
    await registerDomain('');
    await registrars[''].register(labelhash('reverse'), owner.address).then((tx) => tx.wait());
    await ens
        .setSubnodeOwner(
            ethers.utils.namehash('reverse'),
            labelhash('addr'),
            reverseRegistrar.address,
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
    async function registerDomain(label: string, domain: string = '') {
        const name = domain ? `${label}.${domain}` : `${label}`;
        const labelHash = label ? labelhash(label) : '0x0';
        const nameHash = name ? ethers.utils.namehash(name) : ethers.constants.HashZero;
        const existingRegistrarAddress = await ens.owner(nameHash);
        let registrar;
        if ((await ethers.provider.getCode(existingRegistrarAddress)) == '0x') {
            registrar = (await deploy(
                new FIFSRegistrar__factory(),
                owner,
                [ens.address, nameHash],
                { quiet: true },
            )) as FIFSRegistrar;
            if (!!name) {
                await registrars[domain]
                    .register(labelHash, registrar.address)
                    .then((tx) => tx.wait());
            } else {
                await ens.setOwner(nameHash, registrar.address).then((tx) => tx.wait());
            }
        } else {
            registrar = FIFSRegistrar__factory.connect(existingRegistrarAddress, ethers.provider);
        }
        registrars[name] = registrar;
        console.log(`FIFSRegistrar for domain ${name}: ${registrars[name].address}`);
        return registrar;
    }

    /**
     * Register address on ENS.
     */
    async function registerAddress(label: string, domain: string, address: string) {
        const name = `${label}.${domain}`;
        const labelHash = labelhash(label);
        const nameHash = ethers.utils.namehash(name);
        // register as subdomain
        await registrars[domain]
            .connect(owner)
            .register(labelHash, owner.address)
            .then((tx) => tx.wait());
        // link to ens (resolver & addr)
        await ens
            .connect(owner)
            .setResolver(nameHash, resolver.address)
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
            .setName(ens.address, name)
            .then((tx) => tx.wait());
    }

    /**
     * Hash a label for the ENS.
     * See: https://docs.ens.domains/resolution/names#labelhash
     */
    function labelhash(label: string) {
        return ethers.utils.id(label.toLowerCase());
    }
};
